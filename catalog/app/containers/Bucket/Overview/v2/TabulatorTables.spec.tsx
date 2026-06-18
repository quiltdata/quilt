import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ThemeOptions, ThemeProvider, createMuiTheme } from '@material-ui/core/styles'

import * as NamedRoutes from 'utils/NamedRoutes'

import { Loading } from '../../Queries/Athena/model/utils'

import TabulatorTables from './TabulatorTables'

vi.mock('constants/config', () => ({ default: {} }))

// TabulatorSchemaDialog (mounted when Preview is clicked) uses these.
vi.mock('containers/Notifications', () => ({ use: () => ({ push: vi.fn() }) }))
vi.mock('utils/clipboard', () => ({ default: vi.fn() }))

const useTabulatorTables = vi.fn<(bucket: string) => unknown>()
vi.mock('../../Tabulator/requests', () => ({
  useTabulatorTables: (bucket: string) => useTabulatorTables(bucket),
}))

// The component uses t.typography.monospace.fontFamily, a custom theme token;
// provide it so makeStyles doesn't throw during tests.
const theme = createMuiTheme({
  typography: { monospace: { fontFamily: 'monospace' } } as ThemeOptions['typography'],
})

const routes = {
  bucketQueries: { path: '', url: (bucket: string) => `/b/${bucket}/queries` },
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
  })

  it('renders nothing while loading', () => {
    useTabulatorTables.mockReturnValue(Loading)
    const { queryByText, container } = renderTables()
    expect(queryByText(/Tabulator tables/)).toBeNull()
    expect(container.querySelector('.MuiLinearProgress-root')).toBeTruthy()
  })

  it('renders an inline error without crashing', () => {
    useTabulatorTables.mockReturnValue(new Error('boom'))
    const { getByText, queryByText } = renderTables()
    expect(getByText(/Could not load/i)).toBeTruthy()
    expect(queryByText(/Tabulator tables ·/)).toBeNull()
  })

  it('renders nothing when the list is empty', () => {
    useTabulatorTables.mockReturnValue([])
    const { container } = renderTables()
    expect(container.textContent).toBe('')
  })

  it('renders the title, table names, source and a link to queries', () => {
    useTabulatorTables.mockReturnValue([makeTable('drugs', 3), makeTable('bonds', 2)])
    const { getByText } = renderTables('my-bucket')
    expect(getByText(/Tabulator tables/)).toBeTruthy()
    expect(getByText('drugs')).toBeTruthy()
    expect(getByText('bonds')).toBeTruthy()
    expect(getByText(/a\/b · drugs\.csv/)).toBeTruthy()
    const link = getByText(/More queries/i).closest('a')
    expect(link!.getAttribute('href')).toBe('/b/my-bucket/queries')
  })

  it('shows the first columns inline and a "+N more" chip for wide tables', () => {
    useTabulatorTables.mockReturnValue([makeTable('drugs', 9)])
    const { getByText } = renderTables()
    expect(getByText('col_0')).toBeTruthy()
    expect(getByText('col_5')).toBeTruthy()
    // 9 columns, 6 shown -> "+3 more"
    expect(getByText('+3 more')).toBeTruthy()
  })

  it('opens the schema dialog when Preview is clicked', () => {
    useTabulatorTables.mockReturnValue([makeTable('drugs', 2)])
    const { getAllByText, getByText } = renderTables('my-bucket')
    fireEvent.click(getByText('Preview'))
    // The dialog renders its own SELECT and "Open in Queries" action.
    expect(getByText(/SELECT \* FROM "my-bucket"\."drugs" LIMIT 100/)).toBeTruthy()
    // The table name now appears both in the row and the dialog title.
    expect(getAllByText('drugs').length).toBeGreaterThan(1)
  })

  it('per-row Query links to the queries tab', () => {
    useTabulatorTables.mockReturnValue([makeTable('drugs', 2)])
    const { getByText } = renderTables('my-bucket')
    const link = getByText('Query').closest('a')
    expect(link!.getAttribute('href')).toBe('/b/my-bucket/queries')
  })
})
