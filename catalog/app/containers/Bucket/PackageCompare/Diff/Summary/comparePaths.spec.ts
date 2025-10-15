import comparePaths from './comparePaths'

describe('containers/Bucket/PackageCompare/Diff/Summary/comparePaths', () => {
  it('should return null for identical strings', () => {
    expect(comparePaths('hello', 'hello')).toBeNull()
    expect(comparePaths('', '')).toBeNull()
    expect(comparePaths('a', 'a')).toBeNull()
    expect(comparePaths('long/path/to/file.txt', 'long/path/to/file.txt')).toBeNull()
  })

  it('should handle completely different strings', () => {
    const result = comparePaths('abc', 'xyz')
    expect(result).toEqual({
      head: undefined,
      changes: ['abc', 'xyz'],
      tail: undefined,
    })
  })

  it('should handle strings with common prefix', () => {
    const result = comparePaths('prefix_old', 'prefix_new')
    expect(result).toEqual({
      head: 'prefix_',
      changes: ['old', 'new'],
      tail: undefined,
    })
  })

  it('should handle strings with common suffix', () => {
    const result = comparePaths('old_suffix', 'new_suffix')
    expect(result).toEqual({
      head: undefined,
      changes: ['old', 'new'],
      tail: '_suffix',
    })
  })

  it('should handle strings with both common prefix and suffix', () => {
    const result = comparePaths('prefix_old_suffix', 'prefix_new_suffix')
    expect(result).toEqual({
      head: 'prefix_',
      changes: ['old', 'new'],
      tail: '_suffix',
    })
  })

  it('should handle file paths with common directory structure', () => {
    const result = comparePaths(
      'src/components/OldComponent.tsx',
      'src/components/NewComponent.tsx',
    )
    expect(result).toEqual({
      head: 'src/components/',
      changes: ['Old', 'New'],
      tail: 'Component.tsx',
    })
  })

  it('should handle single character differences', () => {
    const result = comparePaths('a', 'b')
    expect(result).toEqual({
      head: undefined,
      changes: ['a', 'b'],
      tail: undefined,
    })
  })

  it('should handle insertion in the middle', () => {
    const result = comparePaths('abc', 'aXbc')
    expect(result).toEqual({
      head: 'a',
      changes: ['', 'X'],
      tail: 'bc',
    })
  })

  it('should handle deletion in the middle', () => {
    const result = comparePaths('aXbc', 'abc')
    expect(result).toEqual({
      head: 'a',
      changes: ['X', ''],
      tail: 'bc',
    })
  })

  it('should handle strings where one is a substring of another', () => {
    const result1 = comparePaths('testing', 'test')
    expect(result1).toEqual({
      head: 'test',
      changes: ['ing', ''],
      tail: undefined,
    })
    const result2 = comparePaths('test', 'testing')
    expect(result2).toEqual({
      head: 'test',
      changes: ['', 'ing'],
      tail: undefined,
    })
  })

  it('should handle empty strings', () => {
    const result1 = comparePaths('', 'something')
    expect(result1).toEqual({
      head: undefined,
      changes: ['', 'something'],
      tail: undefined,
    })

    const result2 = comparePaths('something', '')
    expect(result2).toEqual({
      head: undefined,
      changes: ['something', ''],
      tail: undefined,
    })
  })

  it('should handle complex path differences', () => {
    const result = comparePaths(
      'app/containers/Bucket/PackageCompare/Diff/Summary/OldFile.tsx',
      'app/containers/Bucket/PackageCompare/Diff/Summary/NewFile.tsx',
    )
    expect(result).toEqual({
      head: 'app/containers/Bucket/PackageCompare/Diff/Summary/',
      changes: ['Old', 'New'],
      tail: 'File.tsx',
    })
  })
})
