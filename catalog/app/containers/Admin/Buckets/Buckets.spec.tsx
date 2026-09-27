import * as React from 'react'
import type { History } from 'history'
import { createMemoryHistory } from 'history'
import { Route, Router } from 'react-router-dom'
import { ThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import { act, fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { HTTPError } from 'utils/APIConnector'

// Hoisted because the GraphQL mock below is hoisted above the module body.
const { bucketFields } = vi.hoisted(() => ({
  bucketFields: {
    title: 'Bucket',
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
  },
}))

// jsdom has no IntersectionObserver, which `StickyActions` constructs on mount.
vi.stubGlobal(
  'IntersectionObserver',
  class {
    observe() {}
    disconnect() {}
  },
)

// The dialog's own request, so a refusal can be driven through it. The rest of the module
// is real: `HTTPError` is what `serverMessage` and the catch's status checks read.
const req = vi.fn()
vi.mock('utils/APIConnector', async (importOriginal) => ({
  ...(await importOriginal<typeof import('utils/APIConnector')>()),
  use: () => req,
}))

vi.mock('containers/Notifications', () => ({ use: () => ({ push: vi.fn() }) }))
// `constants/config` reads window.QUILT_CATALOG_CONFIG at module load, so without
// this the suite fails to import at all.
vi.mock('constants/config', () => ({ default: {} }))
// `EditPage` reads two queries, and the cards this spec does not exercise run their own
// on mount; only the shapes they read are stubbed. Keyed off the query's own variables so
// the bucket-scoped one answers for whichever bucket the route names.
vi.mock('utils/GraphQL', () => ({
  useQueryS: (_query: unknown, vars?: { bucket?: string }) =>
    vars?.bucket
      ? { bucketConfig: { tabulatorTables: [] } }
      : {
          bucketConfigs: [
            { ...bucketFields, name: 'bucket-a' },
            { ...bucketFields, name: 'bucket-b' },
          ],
          config: {
            contentIndexingSettings: {
              extensions: [],
              bytesDefault: 0,
              bytesMin: 0,
              bytesMax: 1,
            },
          },
        },
  useMutation: () => async () => ({
    bucketUpdate: { __typename: 'BucketUpdateSuccess' },
  }),
}))
vi.mock('utils/NamedRoutes', () => ({
  use: () => ({ urls: { bucketFile: () => '', adminBuckets: () => '/admin/buckets' } }),
}))
vi.mock('./Tabulator', () => ({ default: () => null }))

import { EditPage, serverMessage } from './Buckets'

const httpError = (text: string, status = 400) =>
  new HTTPError({ status, statusText: 'Bad Request' }, text)

const theme = createMuiTheme()

// Rendered through its real route so the bucket changes the way navigation changes it:
// the same in-place re-render the fix has to survive.
const renderEditRoute = (history: History) =>
  render(
    <Router history={history}>
      <ThemeProvider theme={theme}>
        <Route path="/admin/buckets/:bucketName">
          <EditPage back={() => {}} />
        </Route>
      </ThemeProvider>
    </Router>,
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

describe('containers/Admin/Buckets/EditPage', () => {
  it('leaves no re-index dialog open on the next bucket', async () => {
    const history = createMemoryHistory({
      initialEntries: ['/admin/buckets/bucket-a'],
    })
    const { getByPlaceholderText, getByText, queryByPlaceholderText } =
      renderEditRoute(history)
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

    // One route serves every bucket, so this re-renders the subtree in place; the dialog
    // never exits, so its own `onExited` reset does not run. Both its prefix and its
    // open-ness would otherwise survive, leaving it armed at the new bucket.
    await act(async () => {
      history.push('/admin/buckets/bucket-b')
    })

    // Asserted alongside the absence so a page that rendered nothing at all (a redirect,
    // a failing query) cannot pass as a closed dialog.
    expect(getByText('s3://bucket-b')).toBeTruthy()
    expect(queryByPlaceholderText(/whole bucket/)).toBe(null)
  })

  it('does not guard the next bucket with the previous one’s unsaved changes', async () => {
    const confirmNavigation = vi.fn(() => true)
    const history = createMemoryHistory({
      initialEntries: ['/admin/buckets/bucket-a'],
      getUserConfirmation: (_m, cb) => cb(confirmNavigation()),
    })
    const { getByPlaceholderText } = renderEditRoute(history)

    // Two cards, because the count is per-card: with one edit the surplus happens to
    // cancel out, and only a second leaves a count the next bucket inherits.
    await act(async () => {
      fireEvent.change(getByPlaceholderText(/Production analytics data/), {
        target: { value: 'edited' },
      })
    })
    await act(async () => {
      fireEvent.change(getByPlaceholderText(/Higher numbers appear first/), {
        target: { value: '5' },
      })
    })

    // Asserted, not assumed: if the edits stopped registering as dirty the guard below
    // would pass for the wrong reason.
    await act(async () => {
      history.push('/admin/buckets/bucket-b')
    })
    expect(confirmNavigation).toHaveBeenCalled()
    confirmNavigation.mockClear()

    // `Prompt` installs a history block only while the tree is dirty, and the router asks
    // `getUserConfirmation` only when one is installed -- so a call here would mean
    // bucket-b's pristine forms inherited bucket-a's dirty count.
    await act(async () => {
      history.push('/admin/buckets')
    })
    expect(confirmNavigation).not.toHaveBeenCalled()
  })

  it.each([
    [
      'the registry’s own reason for a refusal it names',
      httpError(JSON.stringify({ message: "'prefix' was unexpected" }), 400),
      "'prefix' was unexpected",
    ],
    [
      'a generic error when the message did not come from the registry',
      httpError('<html><body>502 Bad Gateway</body></html>', 502),
      'Unexpected error',
    ],
  ])('shows %s', async (_name, rejection, shown) => {
    req.mockRejectedValueOnce(rejection)
    const history = createMemoryHistory({ initialEntries: ['/admin/buckets/bucket-a'] })
    const { getByText } = renderEditRoute(history)

    await act(async () => {
      fireEvent.click(getByText('Re-index and repair'))
    })
    await act(async () => {
      fireEvent.click(getByText('Re-index'))
    })

    expect(getByText(shown)).toBeTruthy()
  })
})
