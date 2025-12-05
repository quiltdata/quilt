import { describe, it, expect } from 'vitest'

import * as Model from 'model'

import comparePackageEntries from './comparePackageEntries'

describe('containers/Bucket/PackageCompare/Diff/Summary/comparePackageEntries', () => {
  function createEntry(overrides: Partial<Model.PackageEntry> = {}): Model.PackageEntry {
    return {
      physicalKey: 's3://bucket/key',
      size: 1024,
      hash: {
        type: 'SHA256',
        value: 'abcd1234',
      },
      meta: {
        user_meta: { key: 'value' },
      },
      ...overrides,
    }
  }

  describe('compareHash', () => {
    it('should return no changes when hashes identical', () => {
      const base = createEntry({ hash: { type: 'SHA256', value: 'hash1' } })
      const other = createEntry({ hash: { type: 'SHA256', value: 'hash1' } })

      const result = comparePackageEntries({ foo: base }, { foo: other })
      expect(result).toHaveLength(0)
    })

    it('should detect hash type changes', () => {
      const base = createEntry({ hash: { type: 'SHA256', value: 'hash1' } })
      const other = createEntry({
        hash: { type: 'sha2-256-chunked', value: 'hash1' },
      })

      const result = comparePackageEntries({ foo: base }, { foo: other })
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        _tag: 'modified',
        logicalKey: 'foo',
        changed: {
          hash: { type: ['SHA256', 'sha2-256-chunked'] },
        },
      })
    })

    it('should detect hash value changes', () => {
      const base = createEntry({ hash: { type: 'SHA256', value: 'hash1' } })
      const other = createEntry({ hash: { type: 'SHA256', value: 'hash2' } })

      const result = comparePackageEntries({ foo: base }, { foo: other })
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        _tag: 'modified',
        logicalKey: 'foo',
        changed: {
          hash: { value: ['hash1', 'hash2'] },
        },
      })
    })
  })

  describe('comparePhysicalKey', () => {
    it('should return no changes when physical keys identical', () => {
      const base = createEntry({ physicalKey: 's3://bucket/key?versionId=v1' })
      const other = createEntry({ physicalKey: 's3://bucket/key?versionId=v1' })

      const result = comparePackageEntries({ foo: base }, { foo: other })
      expect(result).toHaveLength(0)
    })

    it('should detect version changes', () => {
      const base = createEntry({ physicalKey: 's3://bucket/key?versionId=v1' })
      const other = createEntry({ physicalKey: 's3://bucket/key?versionId=v2' })

      const result = comparePackageEntries({ foo: base }, { foo: other })
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        _tag: 'modified',
        logicalKey: 'foo',
        changed: {
          physicalKey: { _tag: 'version' },
        },
      })
    })

    it('should detect moved files', () => {
      const base = createEntry({ physicalKey: 's3://bucket/old-key?versionId=v1' })
      const other = createEntry({ physicalKey: 's3://bucket/new-key?versionId=v2' })

      const result = comparePackageEntries({ foo: base }, { foo: other })
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        _tag: 'modified',
        logicalKey: 'foo',
        changed: {
          physicalKey: {
            _tag: 'moved',
            changed: [
              { bucket: 'bucket', key: 'old-key', version: 'v1' },
              { bucket: 'bucket', key: 'new-key', version: 'v2' },
            ],
          },
        },
      })
    })
  })

  describe('compareSize', () => {
    it('should return no changes when sizes identical', () => {
      const base = createEntry({ size: 1024 })
      const other = createEntry({ size: 1024 })

      const result = comparePackageEntries({ foo: base }, { foo: other })
      expect(result).toHaveLength(0)
    })

    it('should detect size changes', () => {
      const base = createEntry({ size: 1024 })
      const other = createEntry({ size: 2048 })

      const result = comparePackageEntries({ foo: base }, { foo: other })
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        _tag: 'modified',
        logicalKey: 'foo',
        changed: {
          size: [1024, 2048],
        },
      })
    })
  })

  describe('getEntryChanges', () => {
    it('should detect added entries', () => {
      const result = comparePackageEntries({}, { 'new-file.txt': createEntry() })
      expect(result).toEqual([{ _tag: 'added', logicalKey: 'new-file.txt' }])
    })

    it('should detect removed entries', () => {
      const result = comparePackageEntries({ 'old-file.txt': createEntry() }, {})
      expect(result).toEqual([{ _tag: 'removed', logicalKey: 'old-file.txt' }])
    })

    it('should detect modified entries with multiple changes', () => {
      const base = createEntry({
        size: 1024,
        hash: { type: 'SHA256', value: 'hash1' },
        meta: { user_meta: { value: 'old' } },
      })
      const other = createEntry({
        size: 2048,
        hash: { type: 'SHA256', value: 'hash2' },
        meta: { user_meta: { value: 'new' } },
      })

      const result = comparePackageEntries({ foo: base }, { foo: other })
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        _tag: 'modified',
        logicalKey: 'foo',
        changed: {
          hash: { value: ['hash1', 'hash2'] },
          size: [1024, 2048],
          meta: [
            { _tag: 'modified', pointer: ['value'], oldValue: 'old', newValue: 'new' },
          ],
        },
      })
    })
  })
})
