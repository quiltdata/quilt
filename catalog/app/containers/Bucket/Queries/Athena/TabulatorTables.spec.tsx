import * as React from 'react'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import TabulatorTables from './TabulatorTables'

vi.mock('constants/config', () => ({ default: {} }))

const useTabulatorTables = vi.fn<(bucket: string) => unknown>()
const resolveTabulatorCatalog = vi.fn<(l: readonly string[]) => string | undefined>()
vi.mock('../../Tabulator/requests', () => ({
  useTabulatorTables: (b: string) => useTabulatorTables(b),
  resolveTabulatorCatalog: (l: readonly string[]) => resolveTabulatorCatalog(l),
}))

const queryBody = { setValue: vi.fn() }
const catalogName = { setValue: vi.fn() }
const database = { setValue: vi.fn() }
const modelState = {
  bucket: 'my-bucket',
  queryBody,
  catalogName,
  database,
  catalogNames: { data: { list: ['awsdatacatalog', 'foo-tabulator'] } },
}
// Keep the real Model helpers (hasData, etc.); stub only `use`.
vi.mock('./model', async () => {
  const utils = await vi.importActual<object>('./model/utils')
  return { ...utils, use: () => modelState }
})

function makeTable(name: string, columnCount = 2) {
  return {
    name,
    format: 'csv',
    columns: Array.from({ length: columnCount }, (_, i) => ({
      name: `c${i}`,
      type: 'STRING',
    })),
    source: {
      packageName: { pretty: 'a/b', raw: '^a/b$', isLiteral: true },
      logicalKey: { pretty: `${name}.csv`, raw: `${name}\\.csv`, isLiteral: true },
    },
  }
}

describe('containers/Bucket/Queries/Athena/TabulatorTables', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders nothing when there are no tables', () => {
    useTabulatorTables.mockReturnValue([])
    const { container } = render(<TabulatorTables />)
    expect(container.textContent).toBe('')
  })

  it('renders nothing while loading (no data)', () => {
    useTabulatorTables.mockReturnValue(undefined)
    const { container } = render(<TabulatorTables />)
    expect(container.textContent).toBe('')
  })

  it('renders a chip per table', () => {
    useTabulatorTables.mockReturnValue([makeTable('drugs'), makeTable('bonds')])
    const { getByText } = render(<TabulatorTables />)
    expect(getByText('drugs')).toBeTruthy()
    expect(getByText('bonds')).toBeTruthy()
  })

  it('fills the editor and selects catalog/database on chip click', () => {
    useTabulatorTables.mockReturnValue([makeTable('drugs')])
    resolveTabulatorCatalog.mockReturnValue('foo-tabulator')
    const { getByText } = render(<TabulatorTables />)
    fireEvent.click(getByText('drugs'))
    expect(queryBody.setValue).toHaveBeenCalledWith(
      'SELECT * FROM "foo-tabulator"."my-bucket"."drugs" LIMIT 100',
    )
    expect(catalogName.setValue).toHaveBeenCalledWith('foo-tabulator')
    expect(database.setValue).toHaveBeenCalledWith('my-bucket')
  })

  it('falls back to a two-part SELECT when no tabulator catalog resolves', () => {
    useTabulatorTables.mockReturnValue([makeTable('drugs')])
    resolveTabulatorCatalog.mockReturnValue(undefined)
    const { getByText } = render(<TabulatorTables />)
    fireEvent.click(getByText('drugs'))
    expect(queryBody.setValue).toHaveBeenCalledWith(
      'SELECT * FROM "my-bucket"."drugs" LIMIT 100',
    )
    expect(catalogName.setValue).not.toHaveBeenCalled()
    expect(database.setValue).not.toHaveBeenCalled()
  })
})
