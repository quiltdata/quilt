import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import { act, fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { HTTPError } from 'utils/APIConnector'

// jsdom has no IntersectionObserver, which `StickyActions` constructs on mount.
vi.stubGlobal(
  'IntersectionObserver',
  class {
    observe() {}
    disconnect() {}
  },
)

vi.mock('containers/Notifications', () => ({ use: () => ({ push: vi.fn() }) }))
// `constants/config` reads window.QUILT_CATALOG_CONFIG at module load, so without
// this the suite fails to import at all.
vi.mock('constants/config', () => ({ default: {} }))
// The cards this spec does not exercise still run their own queries and url
// builders on mount; only the shapes they read are stubbed.
vi.mock('utils/GraphQL', () => ({
  useQueryS: () => ({
    config: {
      contentIndexingSettings: {
        extensions: [],
        bytesDefault: 0,
        bytesMin: 0,
        bytesMax: 1,
      },
    },
  }),
}))
vi.mock('utils/NamedRoutes', () => ({ use: () => ({ urls: { bucketFile: () => '' } }) }))
vi.mock('./Tabulator', () => ({ default: () => null }))

import { Edit, serverMessage } from './Buckets'
import * as OnDirty from './OnDirty'

const httpError = (text: string, status = 400) =>
  new HTTPError({ status, statusText: 'Bad Request' }, text)

const theme = createMuiTheme()

const bucket = {
  name: 'bucket-a',
  title: 'Bucket A',
  iconUrl: null,
  description: null,
  relevanceScore: 0,
  tags: [],
  fileExtensionsToIndex: null,
  indexContentBytes: null,
  scannerParallelShardsDepth: null,
  snsNotificationArn: null,
  skipMetaDataIndexing: false,
  browsable: false,
} as unknown as React.ComponentProps<typeof Edit>['bucket']

// `EditPage` wraps `Edit` in this provider; without it the dirty-state spy throws.
const edit = (name: string) => (
  <MemoryRouter>
    <ThemeProvider theme={theme}>
      <OnDirty.Provider>
        <Edit
          bucket={{ ...bucket, name }}
          back={() => {}}
          submit={async () => undefined}
          tabulatorTables={[]}
        />
      </OnDirty.Provider>
    </ThemeProvider>
  </MemoryRouter>
)

describe('containers/Admin/Buckets/serverMessage', () => {
  it('returns the message the registry sent', () => {
    expect(
      serverMessage(
        httpError(JSON.stringify({ message: 'Additional properties are not allowed' })),
      ),
    ).toBe('Additional properties are not allowed')
  })

  it('returns null for a proxy error page, which HTTPError stores as json.message', () => {
    const e = httpError('<html><body><h1>502 Bad Gateway</h1></body></html>', 502)
    // The body reaches `json.message` even though the registry never sent one, which is
    // what a caller reading the error directly would render.
    expect(e.json.message).toContain('502 Bad Gateway')
    expect(serverMessage(e)).toBe(null)
  })

  it('returns null for an empty message rather than blanking the error display', () => {
    expect(serverMessage(httpError(JSON.stringify({ message: '' })))).toBe(null)
  })
})

describe('containers/Admin/Buckets/Edit', () => {
  it('does not carry a typed re-index prefix to the next bucket', async () => {
    const { getByPlaceholderText, getByText, rerender } = render(edit('bucket-a'))
    // Queried by placeholder: MUI v4's TextField sets no `id`, so its label is not
    // associated with the input.
    const prefix = () => getByPlaceholderText(/whole bucket/) as HTMLInputElement

    await act(async () => {
      fireEvent.click(getByText('Re-index and repair'))
    })
    await act(async () => {
      fireEvent.change(prefix(), { target: { value: 'staging/' } })
    })
    expect(prefix().value).toBe('staging/')

    // Navigation to another bucket's edit route re-renders this subtree in place; the
    // dialog never exits, so its own `onExited` reset does not run.
    rerender(edit('bucket-b'))

    expect(prefix().value).toBe('')
  })
})
