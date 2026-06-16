import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import * as NamedRoutes from 'utils/NamedRoutes'

import { Loading } from '../../Queries/Athena/model/utils'

import TabulatorTables from './TabulatorTables'

const useTabulatorTables = vi.fn()

vi.mock('../../Tabulator/requests', () => ({
  useTabulatorTables: (bucket: string) => useTabulatorTables(bucket),
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

describe('containers/Bucket/Overview/v2/TabulatorTables', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
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
    useTabulatorTables.mockReturnValue([
      { __typename: 'TabulatorTable', name: 'clinical_trials' },
      { __typename: 'TabulatorTable', name: 'drug_targets' },
    ])
    const { getByText } = renderTables('my-bucket')
    expect(getByText('clinical_trials')).toBeTruthy()
    expect(getByText('drug_targets')).toBeTruthy()
    const link = getByText(/More queries/i).closest('a')
    expect(link).toBeTruthy()
    expect(link!.getAttribute('href')).toBe('/b/my-bucket/queries')
  })
})
