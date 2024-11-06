import * as React from 'react'
import renderer from 'react-test-renderer'

import WithGlobalDialogs from 'utils/GlobalDialogs'

import Database from './Database'

import * as Model from './model'

jest.mock(
  'constants/config',
  jest.fn(() => ({})),
)

const noop = () => {}

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

  submit: () => Promise.resolve({ id: 'bar' }),

  readyToRun: false,
  running: false,
}

interface ProviderProps {
  children: React.ReactNode
  value: Model.State
}

function Provider({ children, value }: ProviderProps) {
  return <Model.Ctx.Provider value={value}>{children}</Model.Ctx.Provider>
}

describe('containers/Bucket/Queries/Athena/Database', () => {
  beforeAll(() => {})

  afterAll(() => {})

  it('should render skeletons', () => {
    const tree = renderer.create(
      <Provider value={emptyState}>
        <Database />
      </Provider>,
    )
    expect(tree).toMatchSnapshot()
  })

  it('should render selected values', () => {
    const tree = renderer.create(
      <Provider
        value={{
          ...emptyState,
          catalogName: Model.wrapValue('foo', noop),
          catalogNames: Model.wrapData({ list: ['foo'] }, noop),
          databases: Model.wrapData({ list: ['bar'] }, noop),
          database: Model.wrapValue('bar', noop),
        }}
      >
        <Database />
      </Provider>,
    )
    expect(tree).toMatchSnapshot()
  })

  it('should show no value (zero-width space) if selected no value', () => {
    const tree = renderer.create(
      <Provider
        value={{
          ...emptyState,
          catalogName: { value: null, setValue: noop },
          catalogNames: Model.wrapData({ list: ['any'] }, noop),
          databases: Model.wrapData({ list: ['any'] }, noop),
          database: { value: null, setValue: noop },
        }}
      >
        <Database />
      </Provider>,
    )
    expect(tree).toMatchSnapshot()
  })

  it('should disable selection if no spare values', () => {
    const tree = renderer.create(
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
    expect(tree).toMatchSnapshot()
  })

  it('should show error when values failed', () => {
    const tree = renderer.create(
      <WithGlobalDialogs>
        <Provider
          value={{
            ...emptyState,
            catalogName: { value: new Error('Value fail'), setValue: noop },
            database: { value: new Error('Value fail'), setValue: noop },
          }}
        >
          <Database />
        </Provider>
      </WithGlobalDialogs>,
    )
    expect(tree).toMatchSnapshot()
  })

  it('should show error when data failed', () => {
    const tree = renderer.create(
      <WithGlobalDialogs>
        <Provider
          value={{
            ...emptyState,
            catalogNames: { data: new Error('Data fail'), loadMore: noop },
            databases: { data: new Error('Data fail'), loadMore: noop },
          }}
        >
          <Database />
        </Provider>
      </WithGlobalDialogs>,
    )
    expect(tree).toMatchSnapshot()
  })
})
