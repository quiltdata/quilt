import { Json } from 'utils/types'

import * as JSONOneliner from './JSONOneliner'

function printData(data: JSONOneliner.SyntaxData) {
  return data.parts.reduce((memo, p) => memo + p.value, '')
}

describe('utils/JSONOneliner', () => {
  it('should print empty brackets for empty array', () => {
    const value: Json = []
    const limit = 10
    const result = `[  ]`
    const d = JSONOneliner.print(value, limit, true)
    expect(printData(d)).toBe(result)
    expect(d.availableSpace).toBe(limit - result.length)
  })

  it('should print empty brackets for empty object', () => {
    const value = {}
    const limit = 10
    const result = '{  }'
    const d = JSONOneliner.print(value, limit, true)
    expect(printData(d)).toBe(result)
    expect(d.availableSpace).toBe(limit - result.length)
  })

  it('should print all primitive values in array when enough space', () => {
    const value = [1, true, false, 'Lorem', null]
    const limit = 100
    const result = `[ 1, true, false, "Lorem", null ]`
    const d = JSONOneliner.print(value, limit, true)
    expect(printData(d)).toBe(result)
    expect(d.availableSpace).toBe(limit - result.length)
  })

  it('should print all primitive values in object when enough space', () => {
    const value = {
      A: 1,
      B: true,
      C: false,
      D: 'Lorem',
      E: null,
    }
    const limit = 100
    const result = `{ A: 1, B: true, C: false, D: "Lorem", E: null }`
    const d = JSONOneliner.print(value, limit, true)
    expect(printData(d)).toBe(result)
    expect(d.availableSpace).toBe(limit - result.length)
  })

  it('should print placeholders in array when not enough space', () => {
    const value = [1, true, false, 'Lorem', null]
    const limit = 30
    const result = `[ 1, true, false, <…2> ]`
    const d = JSONOneliner.print(value, limit, true)
    expect(printData(d)).toBe(result)
    expect(d.availableSpace).toBe(limit - result.length)
  })

  it('should print placeholders in object when not enough space', () => {
    const value = {
      A: 1,
      B: true,
      C: false,
      D: 'Lorem',
      E: null,
    }
    const limit = 30
    const result = `{ A: 1, B: true, C, <…2> }`
    const d = JSONOneliner.print(value, limit, true)
    expect(printData(d)).toBe(result)
    expect(d.availableSpace).toBe(limit - result.length)
  })

  // TODO: fix it
  it.skip('should print placeholders in arrays for long values when not enough space', () => {
    const value = [
      1,
      'https://ru.wikipedia.org/wiki/%D0%97%D0%B0%D0%B3%D0%BB%D0%B0%D0%B2%D0%BD%D0%B0%D1%8F_%D1%81%D1%82%D1%80%D0%B0%D0%BD%D0%B8%D1%86%D0%B0',
      true,
      false,
      null,
    ]
    const limit = 30
    const result = `[ 1, <…1>, true, false, null ]`
    const d = JSONOneliner.print(value, limit, true)
    expect(printData(d)).toBe(result)
    expect(d.availableSpace).toBe(limit - result.length)
  })

  it('should show key only if value is too long and not enough space', () => {
    const value = {
      A: 1,
      D: 'https://ru.wikipedia.org/wiki/%D0%97%D0%B0%D0%B3%D0%BB%D0%B0%D0%B2%D0%BD%D0%B0%D1%8F_%D1%81%D1%82%D1%80%D0%B0%D0%BD%D0%B8%D1%86%D0%B0',
      B: true,
      C: false,
      E: null,
    }
    const limit = 30
    const result = `{ A: 1, D, B: true, <…2> }`
    const d = JSONOneliner.print(value, limit, true)
    expect(printData(d)).toBe(result)
    expect(d.availableSpace).toBe(limit - result.length)
  })

  it('should print all array values when enough space', () => {
    const value = [[1, 2, 3], 'Lorem', ['a', 'b']]
    const limit = 100
    const result = `[ [ 1, 2, 3 ], "Lorem", [ "a", "b" ] ]`
    const d = JSONOneliner.print(value, limit, true)
    expect(printData(d)).toBe(result)
    expect(d.availableSpace).toBe(limit - result.length)
  })

  it('should print all object values when enough space', () => {
    const value = {
      A: [1, 2, 3],
      B: 'Lorem',
      C: { a: 1, b: 2 },
      D: { a: [1, { c: 3 }, 'a'], b: 2 },
      E: [1, { b: ['c', { d: 'e' }] }, 'a'],
    }
    const limit = 140
    const result = `{ A: [ 1, 2, 3 ], B: "Lorem", C: { a: 1, b: 2 }, D: { a: [ 1, { c: 3 }, "a" ], b: 2 }, E: [ 1, { b: [ "c", { d: "e" } ] }, "a" ] }`
    const d = JSONOneliner.print(value, limit, true)
    expect(printData(d)).toBe(result)
    expect(d.availableSpace).toBe(limit - result.length)
  })

  it('should print placeholders instead object values when not enough space', () => {
    const value = {
      A: [1, 2, 3],
      B: 'Lorem',
      C: { a: 1, b: 2 },
      D: { a: [1, { c: 3 }, 'a'], b: 2 },
      E: [1, { b: ['c', { d: 'e' }] }, 'a'],
    }
    const limit130 = 130
    const result130 = `{ A: [ 1, 2, 3 ], B: "Lorem", C: { a: 1, b: 2 }, D: { a: [ 1, { c: 3 }, "a" ], b: 2 }, E: [ 1, { b: [ "c", <…1> ] }, "a" ] }`

    const limit120 = 120
    const result120 = `{ A: [ 1, 2, 3 ], B: "Lorem", C: { a: 1, b: 2 }, D: { a: [ 1, { c: 3 }, "a" ], b: 2 }, E: [ 1, { b }, "a" ] }`

    const limit110 = 110
    const result110 = `{ A: [ 1, 2, 3 ], B: "Lorem", C: { a: 1, b: 2 }, D: { a: [ 1, { c: 3 }, "a" ], b: 2 }, E: [ 1, <…2> ] }`

    const limit50 = 50
    const result50 = `{ A: [ 1, <…2> ], B: "Lorem", C: { <…2> }, <…2> }`

    const d130 = JSONOneliner.print(value, limit130, true)
    expect(printData(d130)).toBe(result130)
    expect(d130.availableSpace).toBe(limit130 - result130.length)

    const d120 = JSONOneliner.print(value, limit120, true)
    expect(printData(d120)).toBe(result120)
    expect(d120.availableSpace).toBe(limit120 - result120.length)

    const d110 = JSONOneliner.print(value, limit110, true)
    expect(printData(d110)).toBe(result110)
    expect(d110.availableSpace).toBe(limit110 - result110.length)

    const d50 = JSONOneliner.print(value, limit50, true)
    expect(printData(d50)).toBe(result50)
    expect(d50.availableSpace).toBe(limit50 - result50.length)
  })
})
