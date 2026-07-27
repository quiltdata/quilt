import { describe, it, expect } from 'vitest'

import diffJsons from './diffJsons'

describe('containers/Bucket/PackageCompare/Diff/diffJsons', () => {
  it('should return unmodified result for identical objects', () => {
    const obj = { name: 'John', age: 30 }
    const result = diffJsons(obj, obj)
    expect(result).toEqual([{ _tag: 'unmodified', value: 'name: John\nage: 30\n' }])
  })

  it('should detect added properties', () => {
    const base = { name: 'John' }
    const other = { name: 'John', age: 30 }
    const result = diffJsons(base, other)

    expect(result).toContainEqual({ _tag: 'unmodified', value: 'name: John\n' })
    expect(result).toContainEqual({ _tag: 'added', value: 'age: 30\n' })
  })

  it('should detect removed properties', () => {
    const base = { name: 'John', age: 30 }
    const other = { name: 'John' }
    const result = diffJsons(base, other)

    expect(result).toContainEqual({ _tag: 'unmodified', value: 'name: John\n' })
    expect(result).toContainEqual({ _tag: 'removed', value: 'age: 30\n' })
  })

  it('should detect modified properties', () => {
    const base = { name: 'John', age: 30 }
    const other = { name: 'Jane', age: 30 }
    const result = diffJsons(base, other)

    expect(result).toContainEqual({ _tag: 'removed', value: 'name: John\n' })
    expect(result).toContainEqual({ _tag: 'added', value: 'name: Jane\n' })
    expect(result).toContainEqual({ _tag: 'unmodified', value: 'age: 30\n' })
  })

  it('should handle nested objects', () => {
    const base = { user: { name: 'John', age: 30 } }
    const other = { user: { name: 'John', age: 31 } }
    const result = diffJsons(base, other)

    expect(result).toContainEqual({ _tag: 'unmodified', value: 'user:\n  name: John\n' })
    expect(result).toContainEqual({ _tag: 'removed', value: '  age: 30\n' })
    expect(result).toContainEqual({ _tag: 'added', value: '  age: 31\n' })
  })

  it('should handle arrays', () => {
    const base = { items: ['a', 'b'] }
    const other = { items: ['a', 'c'] }
    const result = diffJsons(base, other)

    expect(result).toContainEqual({ _tag: 'unmodified', value: 'items:\n  - a\n' })
    expect(result).toContainEqual({ _tag: 'removed', value: '  - b\n' })
    expect(result).toContainEqual({ _tag: 'added', value: '  - c\n' })
  })

  it('should handle null values correctly', () => {
    const base = null
    const other = { name: 'John' }
    const result = diffJsons(base, other)

    expect(result).toContainEqual({ _tag: 'added', value: 'name: John\n' })
  })

  it('should handle base object being null', () => {
    const base = null
    const other = { name: 'John', age: 30 }
    const result = diffJsons(base, other)

    expect(result).toContainEqual({ _tag: 'added', value: 'name: John\nage: 30\n' })
  })

  it('should handle other object being null', () => {
    const base = { name: 'John', age: 30 }
    const other = null
    const result = diffJsons(base, other)

    expect(result).toContainEqual({ _tag: 'removed', value: 'name: John\nage: 30\n' })
  })

  it('should handle both objects being null', () => {
    const result = diffJsons(null, null)
    expect(result).toEqual([])
  })

  it('should handle complex nested structures', () => {
    const base = {
      user: { name: 'John', settings: { theme: 'dark' } },
      items: [1, 2, 3],
    }
    const other = {
      user: { name: 'Jane', settings: { theme: 'light' } },
      items: [1, 2, 4],
    }
    const result = diffJsons(base, other)

    expect(result).toContainEqual({ _tag: 'unmodified', value: 'user:\n' })
    expect(result).toContainEqual({ _tag: 'removed', value: '  name: John\n' })
    expect(result).toContainEqual({ _tag: 'added', value: '  name: Jane\n' })
    expect(result).toContainEqual({ _tag: 'unmodified', value: '  settings:\n' })
    expect(result).toContainEqual({ _tag: 'removed', value: '    theme: dark\n' })
    expect(result).toContainEqual({ _tag: 'added', value: '    theme: light\n' })
    expect(result).toContainEqual({ _tag: 'unmodified', value: 'items:\n  - 1\n  - 2\n' })
    expect(result).toContainEqual({ _tag: 'removed', value: '  - 3\n' })
    expect(result).toContainEqual({ _tag: 'added', value: '  - 4\n' })
  })
})
