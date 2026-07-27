import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import TabulatorTables from './TabulatorTables'

vi.mock('constants/config', () => ({ default: {} }))

const push = vi.fn()
vi.mock('containers/Notifications', () => ({ use: () => ({ push }) }))

// `useTabulatorTables` returns a tagged result the component switches on.
const useTabulatorTables = vi.fn<() => unknown>(() => ({ _tag: 'ready', tables: [] }))
const resolveTabulatorCatalog = vi.fn<(l: readonly string[]) => string | undefined>()
vi.mock('../../Tabulator/requests', () => ({
  useTabulatorTables: () => useTabulatorTables(),
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

function renderTables(entries: string[] = ['/b/my-bucket/queries/athena']) {
  return render(
    <MemoryRouter initialEntries={entries}>
      <TabulatorTables />
    </MemoryRouter>,
  )
}

describe('containers/Bucket/Queries/Athena/TabulatorTables', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders nothing when there are no tables', () => {
    useTabulatorTables.mockReturnValue({ _tag: 'ready', tables: [] })
    const { container } = renderTables()
    expect(container.textContent).toBe('')
  })

  it('renders nothing while loading (no data)', () => {
    useTabulatorTables.mockReturnValue({ _tag: 'fetching' })
    const { container } = renderTables()
    expect(container.textContent).toBe('')
  })

  it('offers an autofill helper with a chip per table', () => {
    useTabulatorTables.mockReturnValue({
      _tag: 'ready',
      tables: [makeTable('drugs'), makeTable('bonds')],
    })
    const { getByText } = renderTables()
    expect(getByText(/autofill/i)).toBeTruthy()
    expect(getByText('drugs')).toBeTruthy()
    expect(getByText('bonds')).toBeTruthy()
  })

  it('fills the editor and selects catalog/database on chip click', () => {
    useTabulatorTables.mockReturnValue({ _tag: 'ready', tables: [makeTable('drugs')] })
    resolveTabulatorCatalog.mockReturnValue('foo-tabulator')
    const { getByText } = renderTables()
    fireEvent.click(getByText('drugs'))
    expect(queryBody.setValue).toHaveBeenCalledWith(
      'SELECT * FROM "foo-tabulator"."my-bucket"."drugs" LIMIT 100',
    )
    expect(catalogName.setValue).toHaveBeenCalledWith('foo-tabulator')
    expect(database.setValue).toHaveBeenCalledWith('my-bucket')
  })

  it('falls back to a two-part SELECT when no tabulator catalog resolves', () => {
    useTabulatorTables.mockReturnValue({ _tag: 'ready', tables: [makeTable('drugs')] })
    resolveTabulatorCatalog.mockReturnValue(undefined)
    const { getByText } = renderTables()
    fireEvent.click(getByText('drugs'))
    expect(queryBody.setValue).toHaveBeenCalledWith(
      'SELECT * FROM "my-bucket"."drugs" LIMIT 100',
    )
    expect(catalogName.setValue).not.toHaveBeenCalled()
    expect(database.setValue).not.toHaveBeenCalled()
  })

  it('autofills from a ?table= deep link on load', () => {
    useTabulatorTables.mockReturnValue({
      _tag: 'ready',
      tables: [makeTable('drugs'), makeTable('bonds')],
    })
    resolveTabulatorCatalog.mockReturnValue('foo-tabulator')
    renderTables(['/b/my-bucket/queries/athena?table=drugs'])
    expect(queryBody.setValue).toHaveBeenCalledWith(
      'SELECT * FROM "foo-tabulator"."my-bucket"."drugs" LIMIT 100',
    )
    expect(catalogName.setValue).toHaveBeenCalledWith('foo-tabulator')
    expect(database.setValue).toHaveBeenCalledWith('my-bucket')
  })

  it('notifies and fills nothing when the ?table= deep link names an unknown table', () => {
    useTabulatorTables.mockReturnValue({ _tag: 'ready', tables: [makeTable('drugs')] })
    resolveTabulatorCatalog.mockReturnValue('foo-tabulator')
    renderTables(['/b/my-bucket/queries/athena?table=ghost'])
    expect(push).toHaveBeenCalledWith('Table "ghost" not found')
    expect(queryBody.setValue).not.toHaveBeenCalled()
  })

  it('notifies and fills nothing when a ?table= deep link arrives but tables failed to load', () => {
    useTabulatorTables.mockReturnValue({ _tag: 'error', error: new Error('boom') })
    renderTables(['/b/my-bucket/queries/athena?table=drugs'])
    expect(push).toHaveBeenCalledWith('Could not load Tabulator tables')
    expect(queryBody.setValue).not.toHaveBeenCalled()
  })

  it('escapes embedded double-quotes in identifiers', () => {
    useTabulatorTables.mockReturnValue({ _tag: 'ready', tables: [makeTable('we"ird')] })
    resolveTabulatorCatalog.mockReturnValue('foo-tabulator')
    const { getByText } = renderTables()
    fireEvent.click(getByText('we"ird'))
    expect(queryBody.setValue).toHaveBeenCalledWith(
      'SELECT * FROM "foo-tabulator"."my-bucket"."we""ird" LIMIT 100',
    )
  })
})
