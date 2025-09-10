import * as React from 'react'
import { render } from '@testing-library/react'

import TableView from './index'

jest.mock('components/Layout', () => ({
  useSetFullWidth: jest.fn(),
}))

jest.mock('../model', () => ({
  use: () => ({
    state: {
      resultType: 'p',
      view: 't',
    },
  }),
  ResultType: {
    QuiltPackage: 'p',
    S3Object: 'o',
  },
  View: {
    Table: 't',
    List: 'l',
  },
}))

const useResults = jest.fn()
jest.mock('./useResults', () => ({
  useResults: () => useResults(),
}))

jest.mock('../NoResults', () => ({
  Skeleton: () => <div>Loading…</div>,
  Error: ({ children, kind }: { children?: React.ReactNode; kind?: string }) => {
    switch (kind) {
      case 'syntax':
        return (
          <section>
            <h1>Syntax error</h1>
            <details>{children}</details>
          </section>
        )
      case 'timeout':
        return (
          <section>
            <h1>Timeout error</h1>
            <details>{children}</details>
          </section>
        )
      default:
        return (
          <section>
            <h1>Unexpected error</h1>
            <details>{children}</details>
          </section>
        )
    }
  },
}))

jest.mock('./Table', () => ({ hits }: { hits: any[] }) => (
  <table>
    <tbody>
      {hits.map((hit, index) => (
        <tr key={index}>
          <td>{JSON.stringify(hit)}</td>
        </tr>
      ))}
    </tbody>
  </table>
))

const TablePage = () => (
  <TableView emptySlot={<div>No results</div>} onRefine={jest.fn()} />
)

describe('containers/Search/Table/index', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders null for idle state', () => {
    useResults.mockReturnValue([{ _tag: 'idle' }])

    const { container } = render(<TablePage />)
    expect(container).toMatchSnapshot()
  })

  it('renders skeleton for in-progress state', () => {
    useResults.mockReturnValue([{ _tag: 'in-progress' }])

    const { container } = render(<TablePage />)
    expect(container).toMatchSnapshot()
  })

  it('renders error for general fail state', () => {
    useResults.mockReturnValue([
      {
        _tag: 'fail',
        error: {
          _tag: 'general',
          error: new Error('Something went wrong'),
        },
      },
    ])

    const { container } = render(<TablePage />)
    expect(container).toMatchSnapshot()
  })

  it('renders error for page fail state', () => {
    useResults.mockReturnValue([
      {
        _tag: 'fail',
        error: {
          _tag: 'page',
          error: new Error('Page loading failed'),
        },
      },
    ])

    const { container } = render(<TablePage />)
    expect(container).toMatchSnapshot()
  })

  it('renders error for InputError data fail state', () => {
    useResults.mockReturnValue([
      {
        _tag: 'fail',
        error: {
          _tag: 'data',
          error: {
            __typename: 'InputError',
            message: 'We can not handle this input',
          },
        },
      },
    ])

    const { container } = render(<TablePage />)
    expect(container).toMatchSnapshot()
  })

  it('renders error for QuerySyntaxError data fail state', () => {
    useResults.mockReturnValue([
      {
        _tag: 'fail',
        error: {
          _tag: 'data',
          error: {
            __typename: 'InputError',
            name: 'QuerySyntaxError',
            path: 'search.query',
            message: 'Syntax error in query',
          },
        },
      },
    ])

    const { container } = render(<TablePage />)
    expect(container).toMatchSnapshot()
  })

  it('renders timeout error for OperationError data fail state', () => {
    useResults.mockReturnValue([
      {
        _tag: 'fail',
        error: {
          _tag: 'data',
          error: {
            __typename: 'OperationError',
            name: 'Timeout',
            message: 'Request timeout',
          },
        },
      },
    ])

    const { container } = render(<TablePage />)
    expect(container).toMatchSnapshot()
  })

  it('renders operation error for other OperationError data fail state', () => {
    useResults.mockReturnValue([
      {
        _tag: 'fail',
        error: {
          _tag: 'data',
          error: {
            __typename: 'OperationError',
            message: 'Internal server error',
          },
        },
      },
    ])

    const { container } = render(<TablePage />)
    expect(container).toMatchSnapshot()
  })

  it('renders empty slot for empty state', () => {
    useResults.mockReturnValue([{ _tag: 'empty' }])

    const { container } = render(<TablePage />)
    expect(container).toMatchSnapshot()
  })
})
