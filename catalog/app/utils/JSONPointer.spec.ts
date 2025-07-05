import jsonpath from 'jsonpath'
import * as JSONPointer from './JSONPointer'

describe('utils/JSONPointer', () => {
  it('should stringify array of strings to canonical JSON pointer', () => {
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

  it('should convert pointer consisting from ASCII to valid jsonpath', () => {
    const pointer = '/a/b/c'
    const obj = { a: { b: { c: 'true!' } } }
    expect(jsonpath.value(obj, JSONPointer.toJsonPath(pointer))).toBe('true!')
  })

  it('should convert pointer with invalid keys to valid jsonpath', () => {
    const pointer = '/sp ace/da-sh/eq=al/1337e/汉语/.../___/$'
    const obj = {
      'sp ace': {
        'da-sh': { 'eq=al': { '1337e': { 汉语: { '...': { ___: { $: 'true!' } } } } } },
      },
    }
    expect(jsonpath.value(obj, JSONPointer.toJsonPath(pointer))).toBe('true!')
  })

  it('should convert pointer with mixed keys to valid jsonpath', () => {
    const pointer = '/sp ace/da-sh/val/id/1337e/---/12/a'
    const obj = {
      'sp ace': {
        'da-sh': { val: { id: { '1337e': { '---': { 12: { a: 'true!' } } } } } },
      },
    }
    expect(jsonpath.value(obj, JSONPointer.toJsonPath(pointer))).toBe('true!')
  })

  it.skip('FIXME: should handle $$', () => {
    const pointer = '/$$'
    const obj = { $$: 'true!' }
    expect(jsonpath.value(obj, JSONPointer.toJsonPath(pointer))).toBe('true!')
  })
})
