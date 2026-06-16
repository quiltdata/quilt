import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import * as NamedRoutes from 'utils/NamedRoutes'

import { Loading } from '../../Queries/Athena/model/utils'
import type { TablePreviewController } from '../../Tabulator/requests'

import TabulatorTables from './TabulatorTables'

const useTabulatorTables = vi.fn<(bucket: string) => unknown>()
const open = vi.fn()
const close = vi.fn()
const useTablePreview = vi.fn<(bucket: string) => TablePreviewController>(() => ({
  preview: null,
  open,
  close,
}))

vi.mock('../../Tabulator/requests', () => ({
  useTabulatorTables: (bucket: string) => useTabulatorTables(bucket),
  useTablePreview: (bucket: string) => useTablePreview(bucket),
}))

const routes = {
  bucketQueries: { path: '', url: (bucket: string) => `/b/${bucket}/queries` },
}

function renderTables(bucket = 'test-bucket') {
  return render(
    <MemoryRouter>
      <NamedRoutes.Provider routes={routes}>
        <TabulatorTables bucket={bucket} />
      </NamedRoutes.Provider>
    </MemoryRouter>,
  )
}

const TWO_TABLES = [
  { __typename: 'TabulatorTable', name: 'clinical_trials' },
  { __typename: 'TabulatorTable', name: 'drug_targets' },
]

describe('containers/Bucket/Overview/v2/TabulatorTables', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    useTablePreview.mockReturnValue({ preview: null, open, close })
  })

  it('renders nothing while loading', () => {
    useTabulatorTables.mockReturnValue(Loading)
    const { container } = renderTables()
    expect(container.textContent).toBe('')
  })

  it('renders an inline error without crashing', () => {
    useTabulatorTables.mockReturnValue(new Error('boom'))
    const { getByText } = renderTables()
    expect(getByText(/Could not load/i)).toBeTruthy()
  })

  it('renders nothing when the list is empty', () => {
    useTabulatorTables.mockReturnValue([])
    const { container } = renderTables()
    expect(container.textContent).toBe('')
  })

  it('renders the table names and a link to queries', () => {
    useTabulatorTables.mockReturnValue(TWO_TABLES)
    const { getByText } = renderTables('my-bucket')
    expect(getByText('clinical_trials')).toBeTruthy()
    expect(getByText('drug_targets')).toBeTruthy()
    const link = getByText(/More queries/i).closest('a')
    expect(link).toBeTruthy()
    expect(link!.getAttribute('href')).toBe('/b/my-bucket/queries')
  })

  it('triggers a preview run when a table is clicked', () => {
    useTabulatorTables.mockReturnValue(TWO_TABLES)
    const { getByText } = renderTables()
    fireEvent.click(getByText('clinical_trials'))
    expect(open).toHaveBeenCalledWith('clinical_trials')
  })

  it('shows a loading state for the open preview', () => {
    useTabulatorTables.mockReturnValue(TWO_TABLES)
    useTablePreview.mockReturnValue({
      preview: { table: 'clinical_trials', results: Loading },
      open,
      close,
    })
    const { container, getByText } = renderTables()
    // The list still renders both tables alongside the loading preview.
    expect(getByText('clinical_trials')).toBeTruthy()
    expect(getByText('drug_targets')).toBeTruthy()
    expect(container.querySelector('.MuiLinearProgress-root')).toBeTruthy()
  })

  it('renders preview rows and columns for the open table', () => {
    useTabulatorTables.mockReturnValue(TWO_TABLES)
    useTablePreview.mockReturnValue({
      preview: {
        table: 'clinical_trials',
        results: {
          columns: [
            { name: 'id', type: 'varchar' },
            { name: 'phase', type: 'varchar' },
          ],
          rows: [
            ['NCT001', 'II'],
            ['NCT002', 'III'],
          ],
        },
      },
      open,
      close,
    })
    const { getByText } = renderTables()
    expect(getByText('id')).toBeTruthy()
    expect(getByText('phase')).toBeTruthy()
    expect(getByText('NCT001')).toBeTruthy()
    expect(getByText('III')).toBeTruthy()
  })

  it('renders a per-row preview error without breaking the list', () => {
    useTabulatorTables.mockReturnValue(TWO_TABLES)
    useTablePreview.mockReturnValue({
      preview: {
        table: 'clinical_trials',
        results: new Error('Tabulator catalog not found'),
      },
      open,
      close,
    })
    const { getByText } = renderTables()
    expect(getByText(/Tabulator catalog not found/i)).toBeTruthy()
    // List survives the error.
    expect(getByText('drug_targets')).toBeTruthy()
    expect(getByText(/More queries/i)).toBeTruthy()
  })

  it('renders an empty-result message', () => {
    useTabulatorTables.mockReturnValue(TWO_TABLES)
    useTablePreview.mockReturnValue({
      preview: {
        table: 'clinical_trials',
        results: { columns: [], rows: [] },
      },
      open,
      close,
    })
    const { getByText } = renderTables()
    expect(getByText(/No rows/i)).toBeTruthy()
  })
})
