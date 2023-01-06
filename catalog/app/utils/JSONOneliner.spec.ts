import * as JSONOneliner from './JSONOneliner'

function printData(data: JSONOneliner.SyntaxData) {
  return data.parts.reduce((memo, p) => memo + p.value, '')
}

describe('utils/JSONOneliner', () => {
  it('should print empty brackets for empty object', () => {
    const arrayData = JSONOneliner.print([], 10, true)
    const objectData = JSONOneliner.print({}, 10, true)
    expect(printData(arrayData)).toBe('[  ]')
    expect(printData(objectData)).toBe('{  }')
    expect(arrayData.availableSpace).toBe(6)
    expect(objectData.availableSpace).toBe(6)
  })

  it('should print all primitive values when enough space', () => {
    const arrayOfPrimitives = [1, true, false, 'Lorem', null]
    const objectOfPrimitives = {
      A: 1,
      B: true,
      C: false,
      D: 'Lorem',
      E: null,
    }
    const arrayData = JSONOneliner.print(arrayOfPrimitives, 100, true)
    const objectData = JSONOneliner.print(objectOfPrimitives, 100, true)
    expect(printData(arrayData)).toBe(`[ 1, true, false, "Lorem", null ]`)
    expect(printData(objectData)).toBe(`{ A: 1, B: true, C: false, D: "Lorem", E: null }`)
    expect(arrayData.availableSpace).toBe(67)
    expect(objectData.availableSpace).toBe(52)
  })

  it('should print placeholders when not enough space', () => {
    const arrayOfPrimitives = [1, true, false, 'Lorem', null]
    const objectOfPrimitives = {
      A: 1,
      B: true,
      C: false,
      D: 'Lorem',
      E: null,
    }
    const arrayData = JSONOneliner.print(arrayOfPrimitives, 30, true)
    const objectData = JSONOneliner.print(objectOfPrimitives, 30, true)
    expect(printData(arrayData)).toBe(`[ 1, true, false, "Lorem", <…1> ]`)
    expect(printData(objectData)).toBe(`{ A: 1, B: true, C: false, <…2> }`)
    expect(arrayData.availableSpace).toBe(-3)
    expect(objectData.availableSpace).toBe(-3)
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
    }
    const arrayData = JSONOneliner.print(arrayOfObjects, 100, true)
    const objectData = JSONOneliner.print(objectOfObjects, 100, true)
    expect(printData(arrayData)).toBe(`[ [ 1, 2, 3 ], "Lorem", [ "a", "b" ] ]`)
    expect(printData(objectData)).toBe(
      `{ A: [ 1, 2, 3 ], B: "Lorem", C: { a: 1, b: 2 } }`,
    )
    expect(arrayData.availableSpace).toBe(62)
    expect(objectData.availableSpace).toBe(51)
  })
})
