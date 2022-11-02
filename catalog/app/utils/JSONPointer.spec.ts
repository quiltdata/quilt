import * as JSONPointer from './JSONPointer'

describe('utils/JSONPointer', () => {
  it('should stringify array of strings to canonical JSON pointer', () => {
    // TODO: support for numbers
    expect(JSONPointer.stringify(['foo', 123, 'bar', 345])).toBe('/foo/123/bar/345')
  })

  it('should parse JSON pointer to path address as array of strings', () => {
    expect(JSONPointer.parse('/foo/123/bar/345')).toMatchObject([
      'foo',
      '123',
      'bar',
      '345',
    ])
  })

  it('should return JSON pointer from self produced results', () => {
    const pointer = '/foo/123/bar/345'
    expect(JSONPointer.stringify(JSONPointer.parse(pointer))).toBe(pointer)
  })
})
