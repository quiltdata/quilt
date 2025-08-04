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

  it('should get value from pointer consisting from ASCII', () => {
    const pointer = '/a/b/c'
    const obj = { a: { b: { c: 'true!' } } }
    expect(JSONPointer.getValue(obj, pointer)).toBe('true!')
  })

  it('should get value from pointer with invalid keys', () => {
    const pointer = '/sp ace/da-sh/eq=al/1337e/汉语/.../___/$'
    const obj = {
      'sp ace': {
        'da-sh': { 'eq=al': { '1337e': { 汉语: { '...': { ___: { $: 'true!' } } } } } },
      },
    }
    expect(JSONPointer.getValue(obj, pointer)).toBe('true!')
  })

  it('should get value from pointer with mixed keys', () => {
    const pointer = '/sp ace/da-sh/val/id/1337e/---/12/a'
    const obj = {
      'sp ace': {
        'da-sh': { val: { id: { '1337e': { '---': { 12: { a: 'true!' } } } } } },
      },
    }
    expect(JSONPointer.getValue(obj, pointer)).toBe('true!')
  })

  it('should get value from pointer with single quotes', () => {
    const pointer = "/a/b'c'd/e"
    const obj = {
      a: {
        "b'c'd": { e: 'true!' },
      },
    }
    expect(JSONPointer.getValue(obj, pointer)).toBe('true!')
  })

  it('should get value from pointer with double quotes', () => {
    const pointer = `/a/b"c"d/e"f'g/h`
    const obj = {
      a: {
        'b"c"d': { [`e"f'g`]: { h: 'true!' } },
      },
    }
    expect(JSONPointer.getValue(obj, pointer)).toBe('true!')
  })

  it('should get value from pointer with $$', () => {
    const pointer = '/$$'
    const obj = { $$: 'true!' }
    expect(JSONPointer.getValue(obj, pointer)).toBe('true!')
  })

  it('should return `undefined` when value not found', () => {
    expect(JSONPointer.getValue({ d: 'true!' }, '/d')).toBe('true!')
    expect(JSONPointer.getValue({ d: 'true!' }, '/a/b')).toBe(undefined)
    expect(JSONPointer.getValue({}, '/a')).toBe(undefined)
  })
})
