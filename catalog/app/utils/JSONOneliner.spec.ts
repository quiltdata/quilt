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
  })
})
