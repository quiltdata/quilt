import {
  compareValues,
  compareJsonRecords,
  compareArraysRecursive,
  compareJsons,
} from './compareJsons'

describe('containers/Bucket/PackageCompare/Diff/compareJsons', () => {
  describe('compareValues', () => {
    const pointer = ['anything, it is passed through']

    it('should return empty array for identical primitive values', () => {
      expect(compareValues(pointer, 'hello', 'hello')).toEqual([])
      expect(compareValues(pointer, 42, 42)).toEqual([])
      expect(compareValues(pointer, true, true)).toEqual([])
      expect(compareValues(pointer, null, null)).toEqual([])
    })

    it('should detect added values', () => {
      const result = compareValues(pointer, undefined as any, 'new value')
      expect(result).toEqual([{ _tag: 'added', pointer, newValue: 'new value' }])
    })

    it('should detect removed values', () => {
      const result = compareValues(pointer, 'old value', undefined as any)
      expect(result).toEqual([{ _tag: 'removed', pointer, oldValue: 'old value' }])
    })

    it('should detect modified primitive values', () => {
      const result = compareValues(pointer, 'old', 'new')
      expect(result).toEqual([
        { _tag: 'modified', pointer, oldValue: 'old', newValue: 'new' },
      ])
    })

    it('should detect modified values of different types', () => {
      const primitiveResult = compareValues(pointer, 'string', 42)
      expect(primitiveResult).toEqual([
        { _tag: 'modified', pointer, oldValue: 'string', newValue: 42 },
      ])
      const result = compareValues(pointer, { a: 'b' }, ['a', 'b'])
      expect(result).toEqual([
        { _tag: 'modified', pointer, oldValue: { a: 'b' }, newValue: ['a', 'b'] },
      ])
    })
  })

  describe('compareJsonRecords', () => {
    it('should return empty array for identical objects', () => {
      const obj = { a: 1, b: 'test', c: true }
      expect(compareJsonRecords(obj, { ...obj })).toEqual([])
    })

    it('should detect added properties', () => {
      const base = { a: 1 }
      const other = { a: 1, b: 'new' }
      const result = compareJsonRecords(base, other)

      expect(result).toEqual([{ _tag: 'added', pointer: ['b'], newValue: 'new' }])
    })

    it('should detect removed properties', () => {
      const base = { a: 1, b: 'old' }
      const other = { a: 1 }
      const result = compareJsonRecords(base, other)

      expect(result).toEqual([{ _tag: 'removed', pointer: ['b'], oldValue: 'old' }])
    })

    it('should detect modified properties', () => {
      const base = { a: 1, b: 'old' }
      const other = { a: 1, b: 'new' }
      const result = compareJsonRecords(base, other)

      expect(result).toEqual([
        { _tag: 'modified', pointer: ['b'], oldValue: 'old', newValue: 'new' },
      ])
    })

    it('should handle nested objects', () => {
      const base = { user: { name: 'John', age: 30 } }
      const other = { user: { name: 'Jane', age: 30 } }
      const result = compareJsonRecords(base, other)

      expect(result).toEqual([
        {
          _tag: 'modified',
          pointer: ['user', 'name'],
          oldValue: 'John',
          newValue: 'Jane',
        },
      ])
    })

    it('should handle deeply nested objects', () => {
      const base = { L1: { L2: { L3: { value: 'old' } } } }
      const other = { L1: { L2: { L3: { value: 'new' } } } }
      const result = compareJsonRecords(base, other)

      expect(result).toEqual([
        {
          _tag: 'modified',
          pointer: ['L1', 'L2', 'L3', 'value'],
          oldValue: 'old',
          newValue: 'new',
        },
      ])
    })

    it('should handle multiple changes in nested objects', () => {
      const base = {
        user: { n: 'John', age: 30 },
        opts: { theme: '🌝' },
      }
      const other = {
        user: { n: 'Jane', age: 31 },
        opts: { theme: '☀️', lang: 'en' },
      }
      const result = compareJsonRecords(base, other)

      expect(result).toEqual([
        { _tag: 'modified', pointer: ['user', 'n'], oldValue: 'John', newValue: 'Jane' },
        { _tag: 'modified', pointer: ['user', 'age'], oldValue: 30, newValue: 31 },
        { _tag: 'modified', pointer: ['opts', 'theme'], oldValue: '🌝', newValue: '☀️' },
        { _tag: 'added', pointer: ['opts', 'lang'], newValue: 'en' },
      ])
    })
  })

  describe('compareJsons', () => {
    it('should return empty array for identical primitive values', () => {
      expect(compareJsons('hello', 'hello')).toEqual([])
      expect(compareJsons(42, 42)).toEqual([])
      expect(compareJsons(true, true)).toEqual([])
      expect(compareJsons(false, false)).toEqual([])
    })

    it('should detect changes between different primitive values', () => {
      expect(compareJsons('old', 'new')).toEqual([
        { _tag: 'modified', pointer: [], oldValue: 'old', newValue: 'new' },
      ])
      expect(compareJsons(42, 100)).toEqual([
        { _tag: 'modified', pointer: [], oldValue: 42, newValue: 100 },
      ])
      expect(compareJsons(true, false)).toEqual([
        { _tag: 'modified', pointer: [], oldValue: true, newValue: false },
      ])
    })

    it('should detect changes between different primitive types', () => {
      expect(compareJsons('42', 42)).toEqual([
        { _tag: 'modified', pointer: [], oldValue: '42', newValue: 42 },
      ])
      expect(compareJsons(0, false)).toEqual([
        { _tag: 'modified', pointer: [], oldValue: 0, newValue: false },
      ])
      expect(compareJsons('true', true)).toEqual([
        { _tag: 'modified', pointer: [], oldValue: 'true', newValue: true },
      ])
    })

    it('should handle null values correctly', () => {
      expect(compareJsons(null, null)).toEqual([])
      expect(compareJsons('value', null)).toEqual([
        { _tag: 'modified', pointer: [], oldValue: 'value', newValue: null },
      ])
      expect(compareJsons(null, 'value')).toEqual([
        { _tag: 'modified', pointer: [], oldValue: null, newValue: 'value' },
      ])
      expect(compareJsons(42, null)).toEqual([
        { _tag: 'modified', pointer: [], oldValue: 42, newValue: null },
      ])
      expect(compareJsons(null, 42)).toEqual([
        { _tag: 'modified', pointer: [], oldValue: null, newValue: 42 },
      ])
    })

    it('should handle undefined values correctly', () => {
      expect(compareJsons(undefined, undefined)).toEqual([])
      expect(compareJsons('value', undefined)).toEqual([
        { _tag: 'removed', pointer: [], oldValue: 'value' },
      ])
      expect(compareJsons(undefined, 'value')).toEqual([
        { _tag: 'added', pointer: [], newValue: 'value' },
      ])
      expect(compareJsons(42, undefined)).toEqual([
        { _tag: 'removed', pointer: [], oldValue: 42 },
      ])
      expect(compareJsons(undefined, 42)).toEqual([
        { _tag: 'added', pointer: [], newValue: 42 },
      ])
    })

    it('should handle null vs undefined correctly', () => {
      expect(compareJsons(null, undefined)).toEqual([
        { _tag: 'removed', pointer: [], oldValue: null },
      ])
      expect(compareJsons(undefined, null)).toEqual([
        { _tag: 'added', pointer: [], newValue: null },
      ])
    })
  })

  describe('compareArraysRecursive', () => {
    it('should return empty array for identical arrays', () => {
      const arr = [1, 'test', true]
      expect(compareArraysRecursive(arr, [...arr])).toEqual([])
    })

    it('should detect added array elements', () => {
      const base = [1, 2]
      const other = [1, 2, 3]
      const result = compareArraysRecursive(base, other)

      expect(result).toEqual([{ _tag: 'added', pointer: [2], newValue: 3 }])
    })

    it('should detect removed array elements', () => {
      const base = [1, 2, 3]
      const other = [1, 2]
      const result = compareArraysRecursive(base, other)

      expect(result).toEqual([{ _tag: 'removed', pointer: [2], oldValue: 3 }])
    })

    it('should detect modified array elements', () => {
      const base = [1, 'old', 3]
      const other = [1, 'new', 3]
      const result = compareArraysRecursive(base, other)

      expect(result).toEqual([
        { _tag: 'modified', pointer: [1], oldValue: 'old', newValue: 'new' },
      ])
    })

    it('should handle nested arrays', () => {
      const base = [
        [1, 2],
        [3, 4],
      ]
      const other = [
        [1, 5],
        [3, 4],
      ]
      const result = compareArraysRecursive(base, other)

      expect(result).toEqual([
        { _tag: 'modified', pointer: [0, 1], oldValue: 2, newValue: 5 },
      ])
    })

    it('should handle arrays with objects', () => {
      const base = [{ name: 'John' }, { name: 'Jane' }]
      const other = [{ name: 'John' }, { name: 'Bob' }]
      const result = compareArraysRecursive(base, other)

      expect(result).toEqual([
        { _tag: 'modified', pointer: [1, 'name'], oldValue: 'Jane', newValue: 'Bob' },
      ])
    })

    it('should handle arrays of different lengths with multiple changes', () => {
      const base = [1, 2, 3, 4]
      const other = [1, 'changed', 3]
      const result = compareArraysRecursive(base, other)

      expect(result).toEqual([
        { _tag: 'modified', pointer: [1], oldValue: 2, newValue: 'changed' },
        { _tag: 'removed', pointer: [3], oldValue: 4 },
      ])
    })
  })
})
