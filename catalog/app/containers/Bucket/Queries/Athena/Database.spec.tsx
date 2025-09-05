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

  catalogName: { value: Model.Init, setValue: noop },
  catalogNames: { data: Model.Init, loadMore: noop },
  database: { value: Model.Init, setValue: noop },
  databases: { data: Model.Init, loadMore: noop },
  execution: Model.Init,
  executions: { data: Model.Init, loadMore: noop },
  queries: { data: Model.Init, loadMore: noop },
  query: { value: Model.Init, setValue: noop },
  queryBody: { value: Model.Init, setValue: noop },
  results: { data: Model.Init, loadMore: noop },
  workgroups: { data: Model.Init, loadMore: noop },
  workgroup: { data: Model.Init, loadMore: noop },

  submit: () => Promise.resolve(Model.Payload({ id: 'bar' })),
  queryRun: Model.None,
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
          catalogName: Model.wrapValue(Model.Payload('foo'), noop),
          catalogNames: Model.wrapData(Model.Payload({ list: ['foo'] }), noop),
          databases: Model.wrapData(Model.Payload({ list: ['bar'] }), noop),
          database: Model.wrapValue(Model.Payload('bar'), noop),
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
          catalogName: { value: Model.None, setValue: noop },
          catalogNames: Model.wrapData(Model.Payload({ list: ['any'] }), noop),
          databases: Model.wrapData(Model.Payload({ list: ['any'] }), noop),
          database: { value: Model.None, setValue: noop },
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
          catalogName: { value: Model.None, setValue: noop },
          catalogNames: Model.wrapData(Model.Payload({ list: [] }), noop),
          databases: Model.wrapData(Model.Payload({ list: [] }), noop),
          database: { value: Model.None, setValue: noop },
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
            catalogName: { value: Model.Err(new Error('Value fail')), setValue: noop },
            database: { value: Model.Err(new Error('Value fail')), setValue: noop },
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
            catalogNames: { data: Model.Err(new Error('Data fail')), loadMore: noop },
            databases: { data: Model.Err(new Error('Data fail')), loadMore: noop },
          }}
        >
          <Database />
        </Provider>
      </WithGlobalDialogs>,
    )
    expect(tree).toMatchSnapshot()
  })
})
