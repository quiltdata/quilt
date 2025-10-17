import * as s3paths from 'utils/s3paths'

import { toHandlesMap, merge, SelectionItem, ListingSelection } from './utils'

describe('containers/Bucket/Selection/utils', () => {
  describe('toHandlesMap', () => {
    it('should return empty object for empty selection', () => {
      expect(toHandlesMap({})).toEqual({})

      const selection: ListingSelection = { 's3://bucket/prefix/': [] }
      const result = toHandlesMap(selection)
      expect(result).toEqual({ 's3://bucket/prefix/': [] })
    })

    it('should return converted map', () => {
      const selection: ListingSelection = {
        's3://bucket/prefix/': [{ logicalKey: 'foobar.txt' }],
      }

      const result = toHandlesMap(selection)
      expect(result).toEqual({
        's3://bucket/prefix/': [{ bucket: 'bucket', key: 'prefix/foobar.txt' }],
      })
    })

    it('should return converted map with special chars', () => {
      const prefix = s3paths.handleToS3Url({ bucket: 'bucket', key: 'pre #! fix/' })

      const selection: ListingSelection = {
        [prefix]: [{ logicalKey: 'foo #! bar.txt' }],
      }

      const result = toHandlesMap(selection)
      expect(result).toEqual({
        's3://bucket/pre%20%23!%20fix/': [
          { bucket: 'bucket', key: 'pre #! fix/foo #! bar.txt' },
        ],
      })
    })
  })

  describe('merge', () => {
    const bucket = 'test-bucket'
    const path = 'test/path'
    const prefixUrl = 's3://test-bucket/test/path'

    it('should set items when no filter is provided', () => {
      const items: SelectionItem[] = [
        { logicalKey: 'file1.txt' },
        { logicalKey: 'file2.txt' },
      ]
      const initialState: ListingSelection = {}

      const mergeFunction = merge(items, bucket, path)
      const result = mergeFunction(initialState)

      expect(result).toEqual({
        [prefixUrl]: items,
      })
    })

    it('should replace existing items when no filter is provided', () => {
      const newItems: SelectionItem[] = [
        { logicalKey: 'new1.txt' },
        { logicalKey: 'new2.txt' },
      ]
      const initialState: ListingSelection = {
        [prefixUrl]: [{ logicalKey: 'old1.txt' }, { logicalKey: 'old2.txt' }],
      }

      const mergeFunction = merge(newItems, bucket, path)
      const result = mergeFunction(initialState)

      expect(result).toEqual({
        [prefixUrl]: newItems,
      })
    })

    it('should preserve other prefixes when setting items', () => {
      const items: SelectionItem[] = [{ logicalKey: 'file.txt' }]
      const otherPrefix = 's3://other-bucket/other/path'
      const initialState: ListingSelection = {
        [otherPrefix]: [{ logicalKey: 'other.txt' }],
      }

      const mergeFunction = merge(items, bucket, path)
      const result = mergeFunction(initialState)

      expect(result).toEqual({
        [otherPrefix]: [{ logicalKey: 'other.txt' }],
        [prefixUrl]: items,
      })
    })

    it('should filter out items matching prefix and add new filtered items', () => {
      const filteredItems: SelectionItem[] = [
        { logicalKey: 'temp/new1.txt' },
        { logicalKey: 'temp/new2.txt' },
      ]
      const filter = 'temp/'
      const initialState: ListingSelection = {
        [prefixUrl]: [
          { logicalKey: 'keep/file1.txt' },
          { logicalKey: 'temp/old1.txt' }, // Should be removed
          { logicalKey: 'keep/file2.txt' },
          { logicalKey: 'temp/old2.txt' }, // Should be removed
        ],
      }

      const mergeFunction = merge(filteredItems, bucket, path, filter)
      const result = mergeFunction(initialState)

      expect(result).toEqual({
        [prefixUrl]: [
          { logicalKey: 'keep/file1.txt' },
          { logicalKey: 'keep/file2.txt' },
          { logicalKey: 'temp/new1.txt' },
          { logicalKey: 'temp/new2.txt' },
        ],
      })
    })

    it('should handle root path correctly', () => {
      const items: SelectionItem[] = [{ logicalKey: 'file.txt' }]
      const rootPath = ''
      const rootPrefixUrl = 's3://test-bucket/'

      const mergeFunction = merge(items, bucket, rootPath)
      const result = mergeFunction({})

      expect(result).toEqual({
        [rootPrefixUrl]: items,
      })
    })
  })
})
