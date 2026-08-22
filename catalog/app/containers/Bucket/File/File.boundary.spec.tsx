import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach, beforeAll, beforeEach } from 'vitest'
import { ThemeOptions, ThemeProvider, createMuiTheme } from '@material-ui/core/styles'

import { bucketDir, bucketFile } from 'constants/routes'
import AsyncResult from 'utils/AsyncResult'
import * as NamedRoutes from 'utils/NamedRoutes'

import * as requests from '../requests'

// Containment specs for the File page's panel boundaries.
//
// File.jsx had two bare `throw e` sites in render with no boundary between them
// and `Errors.ErrorBoundary` in app.tsx:
//
//   - the object head (`objExistsData`): any non-`Forbidden` failure
//   - the preview (`versionExistsData`): any preview load failure
//
// Either one replaced the entire catalog with the app-level error screen, for
// what is usually a routine permission or network problem on one panel. These
// tests fail each data source in turn and assert the page's other parts survive.

vi.mock('constants/config', () => ({ default: { analyticsBucket: '' } }))

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')),
  useParams: () => ({ bucket: 'test-bucket', path: 'some/file.csv' }),
  useLocation: () => ({ search: '', pathname: '/', hash: '' }),
}))

// `useData` is the seam both throw sites read from: File.jsx calls it twice with
// `requests.getObjectExistence` -- once for the version-less head (`objExistsData`,
// which omits `version` entirely) and once for the pinned version
// (`versionExistsData`, which passes `version` even when it is undefined). So the
// discriminator is key *presence*, not value: with no `?version=` in the URL both
// calls have `version === undefined`.
const headResult = vi.fn<() => unknown>()
const versionResult = vi.fn<() => unknown>()

vi.mock('utils/Data', () => ({
  useData: (_request: unknown, params: { version?: string; key?: string }) => {
    // objectVersions (used by VersionInfo) also goes through useData; keep it
    // pending so it stays out of the way.
    if (!('resetKey' in params)) {
      return { case: (cases: Record<string, Function>) => (cases._ || cases.Pending)() }
    }
    const result = 'version' in params ? versionResult() : headResult()
    return {
      case: (cases: Record<string, Function>, ...args: unknown[]) =>
        AsyncResult.case(cases, result, ...args),
      fetch: vi.fn(),
    }
  },
}))

// The toolbar is a sibling of the boundaries and must survive both failures --
// it is the page part that proves containment.
vi.mock('./Toolbar', () => ({
  Toolbar: ({ children }: React.PropsWithChildren<{}>) => (
    <div data-testid="toolbar">
      toolbar
      {children}
    </div>
  ),
  CreateHandle: (bucket: string, key: string, version?: string) => ({
    bucket,
    key,
    version,
  }),
  useFeatures: () => ({}),
}))

vi.mock('../FileProperties', () => ({
  default: () => <div data-testid="file-properties" />,
}))

vi.mock('./Analytics', () => ({ default: () => <div data-testid="analytics" /> }))

vi.mock('./AssistantContext', () => ({
  CurrentVersionContext: () => null,
  FileContextFiles: () => null,
  VersionsContext: () => null,
}))

vi.mock('../FileView', async () => ({
  ...(await vi.importActual<typeof import('../FileView')>('../FileView')),
  ObjectMeta: () => <div data-testid="object-meta" />,
  ObjectTags: () => <div data-testid="object-tags" />,
}))

// FallbackToDir wraps the page and does its own S3 probing; pass through so the
// specs exercise File itself.
vi.mock('../FallbackToDir', () => ({
  default: ({ children }: React.PropsWithChildren<{}>) => <>{children}</>,
}))

vi.mock('components/FileEditor', () => ({
  useState: () => ({ editing: false, onEdit: vi.fn(), onSave: vi.fn() }),
  Editor: () => <div data-testid="editor" />,
  Controls: () => null,
  AddFileButton: () => null,
}))

// renderPreview / Preview.load drive the preview branch; the boundary specs only
// need them to not blow up on the success path.
vi.mock('../renderPreview', () => ({
  default: () => () => <div data-testid="preview-body">preview</div>,
}))

vi.mock('components/Preview', () => ({
  CONTEXT: { FILE: 'file' },
  PreviewError: {
    Deleted: (x: unknown) => x,
    Archived: (x: unknown) => x,
    InvalidVersion: (x: unknown) => x,
  },
  load: (_handle: unknown, callback: Function) => callback(AsyncResult.Ok({})),
}))

vi.mock('utils/AWS', () => ({
  S3: { use: () => ({}) },
  Signer: { withDownloadUrl: () => null },
}))

vi.mock('containers/Notifications', () => ({ use: () => ({ push: vi.fn() }) }))

vi.mock('utils/BucketPreferences', async () => {
  const actual = await vi.importActual<typeof import('utils/BucketPreferences')>(
    'utils/BucketPreferences',
  )
  return {
    ...actual,
    use: () => ({
      prefs: actual.Result.Ok({
        ui: { blocks: { analytics: false, meta: true }, actions: { writeFile: false } },
      } as never),
    }),
  }
})

// `requests.ObjectExistence.case` is a tagged matcher and rejects plain objects,
// so build real instances with the real constructor.
const exists = () =>
  requests.ObjectExistence.Exists({
    bucket: 'test-bucket',
    key: 'some/file.csv',
    version: 'v1',
    size: 10,
    deleted: false,
    archived: false,
  })

// Imported once in `beforeAll` rather than per-test.
//
// `File.jsx` pulls in a large dependency graph, and the dynamic import must come
// after the `vi.mock` calls above, so it cannot be a top-level static import.
// Awaiting it inside the first `it` charged the whole ~2.7s module load to that
// one test's 5s timeout while the other four ran in under 20ms each -- so the
// suite sat at ~91% of the budget on CI (4567ms on #5178) and tipped over as
// soon as `File.jsx` grew. Module setup belongs in a hook, where `hookTimeout`
// governs and the cost is not attributed to whichever test happens to run first.
let File: React.ComponentType

beforeAll(async () => {
  File = (await import('./File')).default
})

// File.jsx reads t.typography.monospace.fontFamily, a custom theme token absent
// from the default MUI theme; provide it so makeStyles doesn't throw in tests.
const theme = createMuiTheme({
  typography: { monospace: { fontFamily: 'monospace' } } as ThemeOptions['typography'],
})

function renderFile() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <NamedRoutes.Provider routes={{ bucketDir, bucketFile }}>
          <File />
        </NamedRoutes.Provider>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('containers/Bucket/File containment', () => {
  beforeEach(() => {
    headResult.mockReturnValue(AsyncResult.Ok(exists()))
    versionResult.mockReturnValue(AsyncResult.Ok(exists()))
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('contains an object-head failure to the page body, keeping the toolbar', async () => {
    headResult.mockReturnValue(AsyncResult.Err(new Error('head request failed')))

    const { getByText, getByTestId } = renderFile()

    // The body that failed says so, in place...
    expect(getByText('This object could not be loaded')).toBeTruthy()
    expect(getByText('head request failed')).toBeTruthy()
    // ...and the chrome around it is still on screen. Without the boundary the
    // throw escapes and React unmounts the whole tree.
    expect(getByTestId('toolbar')).toBeTruthy()
  })

  it('contains a preview failure to the Preview section', async () => {
    versionResult.mockReturnValue(AsyncResult.Err(new Error('preview load failed')))

    const { getByText, getByTestId, queryByTestId } = renderFile()

    expect(getByText('Preview unavailable')).toBeTruthy()
    expect(queryByTestId('preview-body')).toBeNull()

    // The object's own metadata and the toolbar are untouched: often all the
    // user needed from the page.
    expect(getByTestId('toolbar')).toBeTruthy()
    expect(getByTestId('object-meta')).toBeTruthy()
    expect(getByTestId('object-tags')).toBeTruthy()
  })

  it('offers a retry on the failed preview', async () => {
    versionResult.mockReturnValue(AsyncResult.Err(new Error('preview load failed')))

    const { getByText } = renderFile()

    // The retry is wired to File's own `handleReload` (bumping `resetKey`), not
    // `resetErrorBoundary`: the failed result is held in `useData` state above
    // the boundary, so a plain reset would re-render the same failure.
    const retry = getByText('Retry')
    expect(retry).toBeTruthy()
    expect(() => fireEvent.click(retry)).not.toThrow()
  })

  // Control, not evidence: `Forbidden` is deliberate signalling that File.jsx
  // already handled before the `throw`, and it must keep its own message rather
  // than being swallowed into a generic panel error. Passes both ways.
  it('still shows Access Denied for a Forbidden head, not the generic panel error', async () => {
    const forbidden = Object.assign(new Error('Forbidden'), { code: 'Forbidden' })
    headResult.mockReturnValue(AsyncResult.Err(forbidden))

    const { getByText, queryByText } = renderFile()

    expect(getByText('Access Denied')).toBeTruthy()
    expect(queryByText('This object could not be loaded')).toBeNull()
  })

  // Control, not evidence: the happy path. Passes with or without the fix.
  it('renders the preview when both reads succeed', async () => {
    const { getByTestId, queryByText } = renderFile()

    expect(getByTestId('preview-body')).toBeTruthy()
    expect(queryByText('Preview unavailable')).toBeNull()
    expect(queryByText('This object could not be loaded')).toBeNull()
  })
})
