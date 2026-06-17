import { renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi, type Mock } from 'vitest'

import * as Model from '../Queries/Athena/model/utils'

import { useTabulatorTables, prettifyPattern, parseTabulatorConfig } from './requests'

vi.mock('constants/config', () => ({ default: {} }))

// Mock only `useQuery` and keep the real `fold` so the fold mapping under test runs for real.
const useQuery: Mock = vi.fn()
vi.mock('utils/GraphQL', async () => ({
  ...(await vi.importActual('utils/GraphQL')),
  useQuery: () => useQuery(),
}))

describe('containers/Bucket/Tabulator/requests', () => {
  describe('useTabulatorTables', () => {
    it('treats a null bucketConfig as no tables', () => {
      useQuery.mockReturnValue({
        fetching: false,
        error: undefined,
        data: { __typename: 'Query', bucketConfig: null },
      })

      const { result } = renderHook(() => useTabulatorTables('test-bucket'))

      expect(result.current).toEqual([])
    })

    it('parses the tabulator tables from bucketConfig', () => {
      useQuery.mockReturnValue({
        fetching: false,
        error: undefined,
        data: {
          __typename: 'Query',
          bucketConfig: {
            __typename: 'BucketConfig',
            name: 'test-bucket',
            tabulatorTables: [
              {
                __typename: 'TabulatorTable',
                name: 't1',
                config: 'schema:\n  - name: id\n    type: INT\nparser:\n  format: csv',
              },
            ],
          },
        },
      })

      const { result } = renderHook(() => useTabulatorTables('test-bucket'))

      expect(result.current).toEqual([
        {
          name: 't1',
          format: 'csv',
          columns: [{ name: 'id', type: 'INT' }],
          source: null,
        },
      ])
    })

    it('yields Loading while fetching', () => {
      useQuery.mockReturnValue({ fetching: true, error: undefined, data: undefined })

      const { result } = renderHook(() => useTabulatorTables('test-bucket'))

      expect(result.current).toBe(Model.Loading)
    })

    it('yields the error when the query fails', () => {
      const error = new Error('boom')
      useQuery.mockReturnValue({ fetching: false, error, data: undefined })

      const { result } = renderHook(() => useTabulatorTables('test-bucket'))

      expect(result.current).toBe(error)
    })
  })
})

describe('containers/Bucket/Tabulator/requests prettifyPattern', () => {
  it('strips anchors and unescapes a literal pattern', () => {
    expect(prettifyPattern('^drugs\\.csv$')).toEqual({
      pretty: 'drugs.csv',
      raw: '^drugs\\.csv$',
      isLiteral: true,
    })
  })

  it('treats a plain package path as a literal', () => {
    expect(prettifyPattern('^alexwilson/drugbank-test$')).toEqual({
      pretty: 'alexwilson/drugbank-test',
      raw: '^alexwilson/drugbank-test$',
      isLiteral: true,
    })
  })

  it('keeps a pattern with capture groups raw', () => {
    const raw = '^ccle/(?<date>[^_]+)_nfcore$'
    expect(prettifyPattern(raw)).toEqual({ pretty: raw, raw, isLiteral: false })
  })

  it('keeps a pattern with an unescaped metacharacter raw', () => {
    const raw = 'salmon/.*\\.sf'
    expect(prettifyPattern(raw)).toEqual({ pretty: raw, raw, isLiteral: false })
  })
})

describe('containers/Bucket/Tabulator/requests parseTabulatorConfig', () => {
  const CONFIG = [
    'schema:',
    '  - name: id',
    '    type: INT',
    '  - name: title',
    '    type: STRING',
    'source:',
    '  type: quilt-packages',
    "  package_name: '^alexwilson/drugbank-test$'",
    "  logical_key: 'drugs\\.csv'",
    'parser:',
    '  format: csv',
  ].join('\n')

  it('parses columns, format and prettified source', () => {
    expect(parseTabulatorConfig('drugs', CONFIG)).toEqual({
      name: 'drugs',
      format: 'csv',
      columns: [
        { name: 'id', type: 'INT' },
        { name: 'title', type: 'STRING' },
      ],
      source: {
        packageName: {
          pretty: 'alexwilson/drugbank-test',
          raw: '^alexwilson/drugbank-test$',
          isLiteral: true,
        },
        logicalKey: { pretty: 'drugs.csv', raw: 'drugs\\.csv', isLiteral: true },
      },
    })
  })

  it('degrades to name only on unparseable/empty config', () => {
    expect(parseTabulatorConfig('broken', ': : :')).toEqual({
      name: 'broken',
      format: '',
      columns: [],
      source: null,
    })
  })

  it('omits source when the source section is incomplete', () => {
    const cfg = 'schema:\n  - name: id\n    type: INT\nparser:\n  format: parquet'
    const result = parseTabulatorConfig('t', cfg)
    expect(result.format).toBe('parquet')
    expect(result.source).toBeNull()
    expect(result.columns).toEqual([{ name: 'id', type: 'INT' }])
  })
})
