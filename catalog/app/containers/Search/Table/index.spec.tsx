import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'

import noop from 'utils/noop'

import type { SearchHitPackage } from '../model'

import TableView from './index'

vi.mock('components/Layout', () => ({
  useSetFullWidth: noop,
}))

vi.mock('../model', () => ({
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

const useResults = vi.fn()
vi.mock('./useResults', () => ({
  useResults: () => useResults(),
}))

vi.mock('../NoResults', () => ({
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

vi.mock('./Table', () => ({
  default: ({ hits }: { hits: SearchHitPackage[] }) => (
    <table>
      <tbody>
        {hits.map((hit) => (
          <tr key={hit.id}>
            <td>{hit.name}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
}))

const TablePage = () => <TableView emptySlot={<div>No results</div>} onRefine={noop} />

describe('containers/Search/Table/index', () => {
  afterEach(cleanup)

  describe('when no results', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('renders null for idle state', () => {
      useResults.mockReturnValue([{ _tag: 'idle' }])

      const { container } = render(<TablePage />)
      expect(container.firstChild).toBe(null)
    })

    it('renders skeleton for in-progress state', () => {
      useResults.mockReturnValue([{ _tag: 'in-progress' }])

      const { container } = render(<TablePage />)
      expect(container.textContent).toBe('Loading…')
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

      const { getByText } = render(<TablePage />)
      expect(getByText('Unexpected error')).toBeTruthy()
      expect(getByText('Something went wrong')).toBeTruthy()
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

      const { getByText } = render(<TablePage />)
      expect(getByText('Unexpected error')).toBeTruthy()
      expect(getByText('Page loading failed')).toBeTruthy()
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

      const { getByText } = render(<TablePage />)
      expect(getByText('Unexpected error')).toBeTruthy()
      expect(getByText('We can not handle this input')).toBeTruthy()
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

      const { getByText } = render(<TablePage />)
      expect(getByText('Syntax error')).toBeTruthy()
      expect(getByText('search.query')).toBeTruthy()
      expect(getByText('Syntax error in query')).toBeTruthy()
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
      expect(container.textContent).toBe('Timeout error')
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

      const { getByText } = render(<TablePage />)
      expect(getByText('Unexpected error')).toBeTruthy()
      expect(getByText('Operation error: Internal server error')).toBeTruthy()
    })

    it('renders empty slot for empty state', () => {
      useResults.mockReturnValue([{ _tag: 'empty' }])

      const { container } = render(<TablePage />)
      expect(container.textContent).toBe('No results')
    })
  })

  describe('when has results', () => {
    it('renders table with rows', () => {
      useResults.mockReturnValue([
        {
          _tag: 'ok',
          hits: [
            { id: '1', name: 'package-1' },
            { id: '2', name: 'package-2' },
          ],
          cursor: null,
          determinate: true,
        },
      ])

      const { getByText } = render(<TablePage />)
      expect(getByText('package-1')).toBeTruthy()
      expect(getByText('package-2')).toBeTruthy()
    })
  })
})
