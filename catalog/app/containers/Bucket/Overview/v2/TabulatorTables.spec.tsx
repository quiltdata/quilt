import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ThemeOptions, ThemeProvider, createMuiTheme } from '@material-ui/core/styles'

import * as NamedRoutes from 'utils/NamedRoutes'

import { Loading } from '../../Queries/Athena/model/utils'

import TabulatorTables from './TabulatorTables'

vi.mock('constants/config', () => ({ default: {} }))

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

  it('renders names and source but hides columns/SELECT while collapsed', () => {
    useTabulatorTables.mockReturnValue([makeTable('drugs', 3), makeTable('bonds', 2)])
    const { getByText, queryByText } = renderTables('my-bucket')
    expect(getByText(/Tabulator tables/)).toBeTruthy()
    expect(getByText('drugs')).toBeTruthy()
    expect(getByText('bonds')).toBeTruthy()
    expect(getByText(/a\/b · drugs\.csv/)).toBeTruthy()
    const link = getByText(/More queries/i).closest('a')
    expect(link!.getAttribute('href')).toBe('/b/my-bucket/queries')
    // Collapsed rows do not expose column chips.
    expect(queryByText('col_0')).toBeNull()
  })

  it('reveals all columns and a Query link when a row is expanded', () => {
    useTabulatorTables.mockReturnValue([makeTable('drugs', 9)])
    const { getByText, queryByText } = renderTables('my-bucket')
    expect(queryByText('col_0')).toBeNull()

    fireEvent.click(getByText('drugs'))

    // All columns are shown (no "+N more" cap once expanded).
    expect(getByText('col_0')).toBeTruthy()
    expect(getByText('col_8')).toBeTruthy()
    expect(queryByText(/\+\d+ more/)).toBeNull()
    const link = getByText(/Query/).closest('a')
    expect(link!.getAttribute('href')).toBe('/b/my-bucket/queries/athena?table=drugs')
  })
})
