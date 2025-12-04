import * as React from 'react'
import { vi } from 'vitest'
import { render } from '@testing-library/react'

import type { SearchHitObject, SearchHitPackage } from '../model'

import ListView from './index'

let firstPageQuery: any = { _tag: 'fetching' }

vi.mock('../model', () => ({
  use: () => ({
    state: {
      resultType: 'p',
      view: 'l',
      buckets: ['test-bucket'],
      latestOnly: true,
    },
    firstPageQuery,
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
  SecureSearch: () => (
    <section>
      <h1>This is secure search.</h1>
      <p>We don't know in advance if users have access to each individual result</p>
    </section>
  ),
}))

vi.mock('./Hit', () => ({
  Object: ({ hit }: { hit: SearchHitObject }) => <div>Object: {hit.key}</div>,
  Package: ({ hit }: { hit: SearchHitPackage }) => (
    <div>
      Package: {hit.name}#{hit.hash}
    </div>
  ),
}))

const ListPage = () => <ListView emptySlot={<div>No results</div>} onRefine={vi.fn()} />

describe('containers/Search/List/index', () => {
  describe('when no results', () => {
    it('renders skeleton for fetching state', () => {
      firstPageQuery = { _tag: 'fetching' }

      const { container } = render(<ListPage />)
      expect(container).toMatchSnapshot()
    })

    it('renders error for error state', () => {
      firstPageQuery = {
        _tag: 'error',
        error: new Error('Network error'),
      }

      const { container } = render(<ListPage />)
      expect(container).toMatchSnapshot()
    })

    it('renders empty slot for EmptySearchResultSet', () => {
      firstPageQuery = {
        _tag: 'data',
        data: {
          __typename: 'EmptySearchResultSet',
        },
      }

      const { container } = render(<ListPage />)
      expect(container).toMatchSnapshot()
    })

    it('renders error for InputError', () => {
      firstPageQuery = {
        _tag: 'data',
        data: {
          __typename: 'InvalidInput',
          errors: [
            {
              name: 'ValidationError',
              path: 'search.query',
              message: 'Invalid search syntax',
            },
          ],
        },
      }

      const { container } = render(<ListPage />)
      expect(container).toMatchSnapshot()
    })

    it('renders syntax error for QuerySyntaxError', () => {
      firstPageQuery = {
        _tag: 'data',
        data: {
          __typename: 'InvalidInput',
          errors: [
            {
              name: 'QuerySyntaxError',
              path: 'search.query',
              message: 'Syntax error in query',
            },
          ],
        },
      }

      const { container } = render(<ListPage />)
      expect(container).toMatchSnapshot()
    })

    it('renders timeout error for OperationError with Timeout', () => {
      firstPageQuery = {
        _tag: 'data',
        data: {
          __typename: 'OperationError',
          name: 'Timeout',
          message: 'Request timeout',
        },
      }

      const { container } = render(<ListPage />)
      expect(container).toMatchSnapshot()
    })

    it('renders operation error for other OperationError', () => {
      firstPageQuery = {
        _tag: 'data',
        data: {
          __typename: 'OperationError',
          name: 'ServerError',
          message: 'Internal server error',
        },
      }

      const { container } = render(<ListPage />)
      expect(container).toMatchSnapshot()
    })
  })

  describe('when has results', () => {
    it('renders PackagesSearchResultSet with empty hits and secure search', () => {
      firstPageQuery = {
        _tag: 'data',
        data: {
          __typename: 'PackagesSearchResultSet',
          total: -1, // secure search
          firstPage: {
            cursor: null,
            hits: [], // We show Secure search "error", only if no results
          },
        },
      }

      const { container } = render(<ListPage />)
      expect(container).toMatchSnapshot()
    })

    it('renders PackagesSearchResultSet with package hits', () => {
      firstPageQuery = {
        _tag: 'data',
        data: {
          __typename: 'PackagesSearchResultSet',
          total: 2,
          firstPage: {
            cursor: null,
            hits: [
              {
                id: '1',
                __typename: 'SearchHitPackage',
                name: 'package-1',
                bucket: 'test-bucket',
                hash: 'abc123',
              } as SearchHitPackage,
              {
                id: '2',
                __typename: 'SearchHitPackage',
                name: 'package-2',
                bucket: 'test-bucket',
                hash: 'def456',
              } as SearchHitPackage,
            ],
          },
        },
      }

      const { container } = render(<ListPage />)
      expect(container).toMatchSnapshot()
    })

    it('renders ObjectsSearchResultSet with object hits', () => {
      firstPageQuery = {
        _tag: 'data',
        data: {
          __typename: 'ObjectsSearchResultSet',
          total: 2,
          firstPage: {
            cursor: null,
            hits: [
              {
                id: '3',
                __typename: 'SearchHitObject',
                key: 'data/file1.csv',
                bucket: 'test-bucket',
              } as SearchHitObject,
              {
                id: '4',
                __typename: 'SearchHitObject',
                key: 'data/file2.json',
                bucket: 'test-bucket',
              } as SearchHitObject,
            ],
          },
        },
      }

      const { container } = render(<ListPage />)
      expect(container).toMatchSnapshot()
    })
  })
})
