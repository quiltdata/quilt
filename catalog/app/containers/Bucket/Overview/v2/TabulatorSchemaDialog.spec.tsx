import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ThemeOptions, ThemeProvider, createMuiTheme } from '@material-ui/core/styles'

import * as NamedRoutes from 'utils/NamedRoutes'

import TabulatorSchemaDialog from './TabulatorSchemaDialog'

vi.mock('constants/config', () => ({ default: {} }))

const push = vi.fn()
vi.mock('containers/Notifications', () => ({ use: () => ({ push }) }))

const copyToClipboard = vi.fn()
vi.mock('utils/clipboard', () => ({ default: (text: string) => copyToClipboard(text) }))

// The component uses t.typography.monospace.fontFamily, a custom theme token;
// provide it so makeStyles doesn't throw during tests.
const theme = createMuiTheme({
  typography: {
    monospace: { fontFamily: 'monospace' },
  } as ThemeOptions['typography'],
})

const routes = {
  bucketQueries: { path: '', url: (bucket: string) => `/b/${bucket}/queries` },
}

const TABLE = {
  name: 'drugs',
  format: 'csv',
  columns: [
    { name: 'id', type: 'INT' },
    { name: 'title', type: 'STRING' },
  ],
  source: {
    packageName: { pretty: 'a/b', raw: '^a/b$', isLiteral: true },
    logicalKey: { pretty: 'drugs.csv', raw: 'drugs\\.csv', isLiteral: true },
  },
}

function renderDialog(table: typeof TABLE | null) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <NamedRoutes.Provider routes={routes}>
          <TabulatorSchemaDialog bucket="my-bucket" table={table} onClose={() => {}} />
        </NamedRoutes.Provider>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('containers/Bucket/Overview/v2/TabulatorSchemaDialog', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders nothing visible when table is null', () => {
    const { queryByText } = renderDialog(null)
    expect(queryByText('drugs')).toBeNull()
  })

  it('renders columns, types and the SELECT for the open table', () => {
    const { getByText } = renderDialog(TABLE)
    expect(getByText('drugs')).toBeTruthy()
    expect(getByText('id')).toBeTruthy()
    expect(getByText('STRING')).toBeTruthy()
    expect(getByText(/SELECT \* FROM "my-bucket"\."drugs" LIMIT 100/)).toBeTruthy()
    const link = getByText(/Open in Queries/i).closest('a')
    expect(link!.getAttribute('href')).toBe('/b/my-bucket/queries')
  })

  it('copies the SELECT and notifies on copy click', () => {
    const { getByTitle } = renderDialog(TABLE)
    fireEvent.click(getByTitle(/copy query/i))
    expect(copyToClipboard).toHaveBeenCalledWith(
      'SELECT * FROM "my-bucket"."drugs" LIMIT 100',
    )
    expect(push).toHaveBeenCalled()
  })
})
