import type * as Model from './requests'
import { parseQueryResults } from './createPackage'

jest.mock(
  'constants/config',
  jest.fn(() => ({})),
)

describe('containers/Bucket/Queries/Athena/model/createPackage', () => {
  describe('parseQueryResults', () => {
    it('should return empty', () => {
      const results: Model.QueryManifests = {
        rows: [],
        columns: [],
      }
      expect(parseQueryResults(results)).toEqual({
        valid: {},
        invalid: [],
      })
    })

    it('should return invalid rows', () => {
      const results1: Model.QueryManifests = {
        rows: [['s3://foo']],
        columns: [{ name: 'physical_key', type: 'varchar' }],
      }
      const results2: Model.QueryManifests = {
        rows: [['s3://foo/a/b/c', 'foo'], ['s3://foo'], ['s3://foo/d/e/f', 'bar', 'baz']],
        columns: [
          { name: 'physical_key', type: 'varchar' },
          { name: 'logical_key', type: 'varchar' },
        ],
      }
      expect(parseQueryResults(results1)).toEqual({
        valid: {},
        invalid: [
          // Not enough columns for a manifest entry
          ['s3://foo'],
        ],
      })
      expect(parseQueryResults(results2)).toEqual({
        valid: {
          foo: {
            bucket: 'foo',
            key: 'a/b/c',
            size: 0,
            version: undefined,
          },
          bar: {
            bucket: 'foo',
            key: 'd/e/f',
            size: 0,
            version: undefined,
          },
        },
        invalid: [
          // Not enough row elements for a manifest entry
          ['s3://foo'],
        ],
      })
    })

    it('should return all valid rows', () => {
      const results: Model.QueryManifests = {
        rows: [
          ['abc', 'a/b/c', '{"a": "b"}', '[s3://a/b/c/d?versionId=def]', '123'],
          ['def', 'd/e/f', '{"d": "e"}', '[s3://d/e/f/g?versionId=ghi]', '456', 'extra'],
          ['xyz', 'x/y/z', '{"x": "y"}', '[s3://x/y/z/w?versionId=uvw]', '789'],
        ],
        columns: [
          { name: 'hash', type: 'varchar' },
          { name: 'logical_key', type: 'varchar' },
          { name: 'meta', type: 'varchar' },
          { name: 'physical_keys', type: 'varchar' },
          { name: 'size', type: 'varchar' },
        ],
      }
      expect(parseQueryResults(results)).toEqual({
        valid: {
          'a/b/c': {
            bucket: 'a',
            key: 'b/c/d',
            size: 123,
            version: 'def',
            // meta: { a: 'b' }, discarded, not supported for creating packages yet
          },
          'd/e/f': {
            bucket: 'd',
            key: 'e/f/g',
            size: 456,
            version: 'ghi',
            // meta: { d: 'e' }, discarded, not supported for creating packages yet
          },
          'x/y/z': {
            bucket: 'x',
            key: 'y/z/w',
            size: 789,
            version: 'uvw',
            // meta: { x: 'y' }, discarded, not supported for creating packages yet
          },
        },
        invalid: [],
      })
    })
  })
})
