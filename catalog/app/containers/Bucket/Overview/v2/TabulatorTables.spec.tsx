import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ThemeOptions, ThemeProvider, createMuiTheme } from '@material-ui/core/styles'

import * as BucketPreferences from 'utils/BucketPreferences'
import * as NamedRoutes from 'utils/NamedRoutes'

import TabulatorTables from './TabulatorTables'

vi.mock('constants/config', () => ({ default: {} }))

// `useTabulatorTables` returns a tagged result the component switches on.
const useTabulatorTables = vi.fn<() => unknown>()
vi.mock('../../Tabulator/requests', () => ({
  useTabulatorTables: () => useTabulatorTables(),
}))

let navQueries = true
vi.mock('utils/BucketPreferences', async () => {
  const actual = await vi.importActual<typeof BucketPreferences>(
    'utils/BucketPreferences',
  )
  return {
    ...actual,
    use: () => ({
      prefs: actual.Result.Ok({
        ui: { nav: { queries: navQueries } },
      } as unknown as Parameters<typeof actual.Result.Ok>[0]),
    }),
  }
})

// The component uses t.typography.monospace.fontFamily, a custom theme token;
// provide it so makeStyles doesn't throw during tests.
const theme = createMuiTheme({
  typography: { monospace: { fontFamily: 'monospace' } } as ThemeOptions['typography'],
})

const routes = {
  bucketQueries: { path: '', url: (bucket: string) => `/b/${bucket}/queries` },
  bucketAthena: { path: '', url: (bucket: string) => `/b/${bucket}/queries/athena` },
}

function makeTable(name: string, columnCount: number) {
  return {
    name,
    format: 'csv',
    columns: Array.from({ length: columnCount }, (_, i) => ({
      name: `col_${i}`,
      type: 'STRING',
    })),
    source: {
      packageName: { pretty: 'a/b', raw: '^a/b$', isLiteral: true },
      logicalKey: { pretty: `${name}.csv`, raw: `${name}\\.csv`, isLiteral: true },
    },
  }
}

function renderTables(bucket = 'test-bucket') {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <NamedRoutes.Provider routes={routes}>
          <TabulatorTables bucket={bucket} />
        </NamedRoutes.Provider>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('containers/Bucket/Overview/v2/TabulatorTables', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    navQueries = true
  })

  it('renders nothing when Queries is disabled (ui.nav.queries=false)', () => {
    navQueries = false
    useTabulatorTables.mockReturnValue({ _tag: 'ready', tables: [makeTable('drugs', 3)] })
    const { container } = renderTables()
    expect(container.textContent).toBe('')
  })

  it('renders nothing while loading', () => {
    useTabulatorTables.mockReturnValue({ _tag: 'fetching' })
    const { queryByText, container } = renderTables()
    expect(queryByText(/Tabulator tables/)).toBeNull()
    expect(container.querySelector('.MuiLinearProgress-root')).toBeTruthy()
  })

  it('renders an inline error without crashing', () => {
    useTabulatorTables.mockReturnValue({ _tag: 'error', error: new Error('boom') })
    const { getByText, queryByText } = renderTables()
    expect(getByText(/Could not load/i)).toBeTruthy()
    expect(queryByText(/Tabulator tables ·/)).toBeNull()
  })

  it('renders nothing when the list is empty', () => {
    useTabulatorTables.mockReturnValue({ _tag: 'ready', tables: [] })
    const { container } = renderTables()
    expect(container.textContent).toBe('')
  })

  it('renders names and source but hides columns/SELECT while collapsed', () => {
    useTabulatorTables.mockReturnValue({
      _tag: 'ready',
      tables: [makeTable('drugs', 3), makeTable('bonds', 2)],
    })
    const { getByText, queryByText } = renderTables('my-bucket')
    expect(getByText(/Tabulator tables/)).toBeTruthy()
    expect(getByText('drugs')).toBeTruthy()
    expect(getByText('bonds')).toBeTruthy()
    expect(getByText(/a\/b · drugs\.csv/)).toBeTruthy()
    const link = getByText(/More queries/i).closest('a')
    expect(link!.getAttribute('href')).toBe('/b/my-bucket/queries')
    expect(queryByText('col_0')).toBeNull()
  })

  it('reveals all columns and a Query link when a row is expanded', () => {
    useTabulatorTables.mockReturnValue({ _tag: 'ready', tables: [makeTable('drugs', 9)] })
    const { getByText, queryByText } = renderTables('my-bucket')
    expect(queryByText('col_0')).toBeNull()

    fireEvent.click(getByText('drugs'))

    expect(getByText('col_0')).toBeTruthy()
    expect(getByText('col_8')).toBeTruthy()
    expect(queryByText(/\+\d+ more/)).toBeNull()
    const link = getByText(/Query/).closest('a')
    expect(link!.getAttribute('href')).toBe('/b/my-bucket/queries/athena?table=drugs')
  })

  it('URL-encodes special characters in the Query deep link', () => {
    useTabulatorTables.mockReturnValue({
      _tag: 'ready',
      tables: [makeTable('we/ird"', 2)],
    })
    const { getByText } = renderTables('my-bucket')
    fireEvent.click(getByText('we/ird"'))
    const link = getByText(/Query/).closest('a')
    expect(link!.getAttribute('href')).toBe(
      '/b/my-bucket/queries/athena?table=we%2Fird%22',
    )
  })
})
