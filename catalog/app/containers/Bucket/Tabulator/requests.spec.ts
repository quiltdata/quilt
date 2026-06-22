import { renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi, type Mock } from 'vitest'

import {
  useTabulatorTables,
  parseTabulatorTables,
  prettifyPattern,
  parseTabulatorConfig,
  resolveTabulatorCatalog,
  TABULATOR_CATALOG_SUFFIX,
} from './requests'

vi.mock('constants/config', () => ({ default: {} }))

const useQuery: Mock = vi.fn()
vi.mock('utils/GraphQL', async () => ({
  ...(await vi.importActual('utils/GraphQL')),
  useQuery: () => useQuery(),
}))

describe('containers/Bucket/Tabulator/requests', () => {
  describe('useTabulatorTables', () => {
    it('yields parsed tables when the query resolves', () => {
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

      expect(result.current).toEqual({
        _tag: 'ready',
        tables: [
          {
            name: 't1',
            format: 'csv',
            columns: [{ name: 'id', type: 'INT' }],
            source: null,
          },
        ],
      })
    })

    it('yields fetching while the query is in flight', () => {
      useQuery.mockReturnValue({ fetching: true, error: undefined, data: undefined })

      const { result } = renderHook(() => useTabulatorTables('test-bucket'))

      expect(result.current).toEqual({ _tag: 'fetching' })
    })

    it('yields the error when the query fails', () => {
      const error = new Error('boom')
      useQuery.mockReturnValue({ fetching: false, error, data: undefined })

      const { result } = renderHook(() => useTabulatorTables('test-bucket'))

      expect(result.current).toEqual({ _tag: 'error', error })
    })
  })

  describe('parseTabulatorTables', () => {
    it('treats a null bucketConfig as no tables', () => {
      expect(parseTabulatorTables({ __typename: 'Query', bucketConfig: null })).toEqual(
        [],
      )
    })

    it('parses the tabulator tables from bucketConfig', () => {
      expect(
        parseTabulatorTables({
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
        }),
      ).toEqual([
        {
          name: 't1',
          format: 'csv',
          columns: [{ name: 'id', type: 'INT' }],
          source: null,
        },
      ])
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
    // utils/yaml.parse logs and swallows the YAMLException; silence it so the
    // expected-failure path doesn't pollute test output.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(parseTabulatorConfig('broken', ': : :')).toEqual({
      name: 'broken',
      format: '',
      columns: [],
      source: null,
    })
    errorSpy.mockRestore()
  })

  it('omits source when the source section is incomplete', () => {
    const cfg = 'schema:\n  - name: id\n    type: INT\nparser:\n  format: parquet'
    const result = parseTabulatorConfig('t', cfg)
    expect(result.format).toBe('parquet')
    expect(result.source).toBeNull()
    expect(result.columns).toEqual([{ name: 'id', type: 'INT' }])
  })
})

describe('containers/Bucket/Tabulator/requests resolveTabulatorCatalog', () => {
  it('exposes the tabulator catalog suffix', () => {
    expect(TABULATOR_CATALOG_SUFFIX).toBe('-tabulator')
  })

  it('returns the first catalog ending with the tabulator suffix', () => {
    expect(
      resolveTabulatorCatalog(['awsdatacatalog', 'mystack-tabulator', 'other-tabulator']),
    ).toBe('mystack-tabulator')
  })

  it('returns undefined when no catalog matches', () => {
    expect(resolveTabulatorCatalog(['awsdatacatalog'])).toBeUndefined()
  })

  it('returns undefined for an empty list', () => {
    expect(resolveTabulatorCatalog([])).toBeUndefined()
  })
})
