import * as React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

import WithGlobalDialogs from 'utils/GlobalDialogs'
import noop from 'utils/noop'
import Database from './Database'

import * as Model from './model'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('components/Skeleton', () => ({
  default: () => <div data-testid="skeleton" />,
}))

vi.mock('@material-ui/lab', async () => ({
  ...(await vi.importActual('@material-ui/lab')),
  Alert: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert">{children}</div>
  ),
}))

const emptyState: Model.State = {
  bucket: 'any',

  catalogName: { value: undefined, setValue: noop },
  catalogNames: { data: undefined, loadMore: noop },
  database: { value: undefined, setValue: noop },
  databases: { data: undefined, loadMore: noop },
  execution: undefined,
  executions: { data: undefined, loadMore: noop },
  queries: { data: undefined, loadMore: noop },
  query: { value: undefined, setValue: noop },
  queryBody: { value: undefined, setValue: noop },
  results: { data: undefined, loadMore: noop },
  workgroups: { data: undefined, loadMore: noop },
  workgroup: { data: undefined, loadMore: noop },

  submit: () => Promise.resolve({ id: 'bar' }),
  queryRun: undefined,
}

interface ProviderProps {
  children: React.ReactNode
  value: Model.State
}

function Provider({ children, value }: ProviderProps) {
  return <Model.Ctx.Provider value={value}>{children}</Model.Ctx.Provider>
}

describe('containers/Bucket/Queries/Athena/Database', () => {
  afterEach(cleanup)

  it('should render skeletons', () => {
    const { getAllByTestId } = render(
      <Provider value={emptyState}>
        <Database />
      </Provider>,
    )
    const skeletons = getAllByTestId('skeleton')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('should render selected values', () => {
    const { getByText } = render(
      <Provider
        value={{
          ...emptyState,
          catalogName: Model.wrapValue('catalog-name-foo', noop),
          catalogNames: Model.wrapData({ list: ['catalog-name-foo'] }, noop),
          databases: Model.wrapData({ list: ['database-bar'] }, noop),
          database: Model.wrapValue('database-bar', noop),
        }}
      >
        <Database />
      </Provider>,
    )
    expect(getByText('catalog-name-foo')).toBeTruthy()
    expect(getByText('database-bar')).toBeTruthy()
  })

  it('should show no value (zero-width space) if selected no value', () => {
    const { queryByText } = render(
      <Provider
        value={{
          ...emptyState,
          catalogName: { value: null, setValue: noop },
          catalogNames: Model.wrapData({ list: ['catalog-option'] }, noop),
          databases: Model.wrapData({ list: ['database-option'] }, noop),
          database: { value: null, setValue: noop },
        }}
      >
        <Database />
      </Provider>,
    )
    expect(queryByText('catalog-option')).toBeFalsy()
    expect(queryByText('database-option')).toBeFalsy()
  })

  it('should disable selection if no spare values', () => {
    const { getByText } = render(
      <Provider
        value={{
          ...emptyState,
          catalogName: { value: null, setValue: noop },
          catalogNames: Model.wrapData({ list: [] }, noop),
          databases: Model.wrapData({ list: [] }, noop),
          database: { value: null, setValue: noop },
        }}
      >
        <Database />
      </Provider>,
    )
    const catalogLabel = getByText('Data catalog')
    expect((catalogLabel.nextElementSibling as HTMLElement).className).toContain(
      'disabled',
    )

    const databaseLabel = getByText('Database')
    expect((databaseLabel.nextElementSibling as HTMLElement).className).toContain(
      'disabled',
    )
  })

  it('should show error when values failed', () => {
    const { getAllByTestId } = render(
      <WithGlobalDialogs>
        <Provider
          value={{
            ...emptyState,
            catalogName: { value: new Error('Catalog value fail'), setValue: noop },
            database: { value: new Error('Database value fail'), setValue: noop },
          }}
        >
          <Database />
        </Provider>
      </WithGlobalDialogs>,
    )
    expect(getAllByTestId('alert').length).toBe(2)
  })

  it('should show error when data failed', () => {
    const { getAllByTestId } = render(
      <WithGlobalDialogs>
        <Provider
          value={{
            ...emptyState,
            catalogNames: { data: new Error('Catalog data fail'), loadMore: noop },
            databases: { data: new Error('Database data fail'), loadMore: noop },
          }}
        >
          <Database />
        </Provider>
      </WithGlobalDialogs>,
    )
    expect(getAllByTestId('alert').length).toBe(2)
  })
})
