import * as JSONOneliner from './JSONOneliner'

function printData(data: JSONOneliner.SyntaxData) {
  return data.parts.reduce((memo, p) => memo + p.value, '')
}

describe('utils/JSONOneliner', () => {
  it('should print empty brackets for empty array', () => {
    const t = {
      value: [],
      limit: 10,
      result: `[  ]`,
    }
    const d = JSONOneliner.print(t.value, t.limit, true)
    expect(printData(d)).toBe(t.result)
    expect(d.availableSpace).toBe(t.limit - t.result.length)
  })

  it('should print empty brackets for empty object', () => {
    const t = {
      value: {},
      limit: 10,
      result: '{  }',
    }
    const d = JSONOneliner.print(t.value, t.limit, true)
    expect(printData(d)).toBe(t.result)
    expect(d.availableSpace).toBe(t.limit - t.result.length)
  })

  it('should print all primitive values in array when enough space', () => {
    const t = {
      value: [1, true, false, 'Lorem', null],
      limit: 100,
      result: `[ 1, true, false, "Lorem", null ]`,
    }
    const d = JSONOneliner.print(t.value, t.limit, true)
    expect(printData(d)).toBe(t.result)
    expect(d.availableSpace).toBe(t.limit - t.result.length)
  })

  it('should print all primitive values in object when enough space', () => {
    const t = {
      value: {
        A: 1,
        B: true,
        C: false,
        D: 'Lorem',
        E: null,
      },
      limit: 100,
      result: `{ A: 1, B: true, C: false, D: "Lorem", E: null }`,
    }
    const d = JSONOneliner.print(t.value, t.limit, true)
    expect(printData(d)).toBe(t.result)
    expect(d.availableSpace).toBe(t.limit - t.result.length)
  })

  it('should print placeholders in array when not enough space', () => {
    const t = {
      value: [1, true, false, 'Lorem', null],
      limit: 30,
      result: `[ 1, true, false, "Lorem", <…1> ]`,
    }
    const d = JSONOneliner.print(t.value, t.limit, true)
    expect(printData(d)).toBe(t.result)
    expect(d.availableSpace).toBe(t.limit - t.result.length)
  })

  it('should print placeholders in object when not enough space', () => {
    const t = {
      value: {
        A: 1,
        B: true,
        C: false,
        D: 'Lorem',
        E: null,
      },
      limit: 30,
      result: `{ A: 1, B: true, C: false, <…2> }`,
    }
    const d = JSONOneliner.print(t.value, t.limit, true)
    expect(printData(d)).toBe(t.result)
    expect(d.availableSpace).toBe(t.limit - t.result.length)
  })

  // TODO: fix it
  it.skip('should print placeholders in arrays for long values when not enough space', () => {
    const arrayOfPrimitives = [
      1,
      'https://ru.wikipedia.org/wiki/%D0%97%D0%B0%D0%B3%D0%BB%D0%B0%D0%B2%D0%BD%D0%B0%D1%8F_%D1%81%D1%82%D1%80%D0%B0%D0%BD%D0%B8%D1%86%D0%B0',
      true,
      false,
      null,
    ]
    const arrayData = JSONOneliner.print(arrayOfPrimitives, 30, true)
    expect(printData(arrayData)).toBe(`[ 1, <…1>, true, false, null ]`)
    expect(arrayData.availableSpace).toBe(-3)
  })

  it('should key only if value is too long and not enough space', () => {
    const objectOfPrimitives = {
      A: 1,
      D: 'https://ru.wikipedia.org/wiki/%D0%97%D0%B0%D0%B3%D0%BB%D0%B0%D0%B2%D0%BD%D0%B0%D1%8F_%D1%81%D1%82%D1%80%D0%B0%D0%BD%D0%B8%D1%86%D0%B0',
      B: true,
      C: false,
      E: null,
    }
    const objectData = JSONOneliner.print(objectOfPrimitives, 30, true)
    expect(printData(objectData)).toBe(`{ A: 1, D, B: true, <…2> }`)
    expect(objectData.availableSpace).toBe(4)
  })

  it('should print all object values when enough space', () => {
    const arrayOfObjects = [[1, 2, 3], 'Lorem', ['a', 'b']]
    const objectOfObjects = {
      A: [1, 2, 3],
      B: 'Lorem',
      C: { a: 1, b: 2 },
      D: { a: [1, { c: 3 }, 'a'], b: 2 },
      E: [1, { b: ['c', { d: 'e' }] }, 'a'],
    }
    const arrayData = JSONOneliner.print(arrayOfObjects, 100, true)
    const objectData = JSONOneliner.print(objectOfObjects, 140, true)
    expect(printData(arrayData)).toBe(`[ [ 1, 2, 3 ], "Lorem", [ "a", "b" ] ]`)
    expect(printData(objectData)).toBe(
      `{ A: [ 1, 2, 3 ], B: "Lorem", C: { a: 1, b: 2 }, D: { a: [ 1, { c: 3 }, "a" ], b: 2 }, E: [ 1, { b: [ "c", { d: "e" } ] }, "a" ] }`,
    )
    expect(arrayData.availableSpace).toBe(62)
    expect(objectData.availableSpace).toBe(10)
  })

  it('should print placeholders instead object values when enough space', () => {
    const objectOfObjects = {
      A: [1, 2, 3],
      B: 'Lorem',
      C: { a: 1, b: 2 },
      D: { a: [1, { c: 3 }, 'a'], b: 2 },
      E: [1, { b: ['c', { d: 'e' }] }, 'a'],
    }

    const objectData130 = JSONOneliner.print(objectOfObjects, 130, true)
    expect(printData(objectData130)).toBe(
      `{ A: [ 1, 2, 3 ], B: "Lorem", C: { a: 1, b: 2 }, D: { a: [ 1, { c: 3 }, "a" ], b: 2 }, E: [ 1, { b: [ "c", { <…1> } ] }, "a" ] }`,
    )
    expect(objectData130.availableSpace).toBe(2)

    const objectData120 = JSONOneliner.print(objectOfObjects, 120, true)
    expect(printData(objectData120)).toBe(
      `{ A: [ 1, 2, 3 ], B: "Lorem", C: { a: 1, b: 2 }, D: { a: [ 1, { c: 3 }, "a" ], b: 2 }, E: [ 1, { b: [ <…2> ] }, "a" ] }`,
    )
    expect(objectData120.availableSpace).toBe(1)

    const objectData110 = JSONOneliner.print(objectOfObjects, 110, true)
    expect(printData(objectData110)).toBe(
      `{ A: [ 1, 2, 3 ], B: "Lorem", C: { a: 1, b: 2 }, D: { a: [ 1, { c: 3 }, "a" ], b: 2 }, E: [ 1, { <…1> }, <…1> ] }`,
    )
    expect(objectData110.availableSpace).toBe(-3)

    const objectData50 = JSONOneliner.print(objectOfObjects, 50, true)
    expect(printData(objectData50)).toBe(
      `{ A: [ <…3> ], B: "Lorem", C: { <…2> }, D: { <…2> }, <…1> }`,
    )
    expect(objectData50.availableSpace).toBe(-9)
  })
})
