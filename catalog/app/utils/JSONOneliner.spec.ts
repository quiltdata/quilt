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
      // TODO: result is longer then limit (33)
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
      // TODO: result is longer then limit (33)
      result: `{ A: 1, B: true, C: false, <…2> }`,
    }
    const d = JSONOneliner.print(t.value, t.limit, true)
    expect(printData(d)).toBe(t.result)
    expect(d.availableSpace).toBe(t.limit - t.result.length)
  })

  // TODO: fix it
  it.skip('should print placeholders in arrays for long values when not enough space', () => {
    const t = {
      value: [
        1,
        'https://ru.wikipedia.org/wiki/%D0%97%D0%B0%D0%B3%D0%BB%D0%B0%D0%B2%D0%BD%D0%B0%D1%8F_%D1%81%D1%82%D1%80%D0%B0%D0%BD%D0%B8%D1%86%D0%B0',
        true,
        false,
        null,
      ],
      limit: 30,
      result: `[ 1, <…1>, true, false, null ]`,
    }
    const d = JSONOneliner.print(t.value, t.limit, true)
    expect(printData(d)).toBe(t.result)
    expect(d.availableSpace).toBe(t.limit - t.result.length)
  })

  it('should show key only if value is too long and not enough space', () => {
    const t = {
      value: {
        A: 1,
        D: 'https://ru.wikipedia.org/wiki/%D0%97%D0%B0%D0%B3%D0%BB%D0%B0%D0%B2%D0%BD%D0%B0%D1%8F_%D1%81%D1%82%D1%80%D0%B0%D0%BD%D0%B8%D1%86%D0%B0',
        B: true,
        C: false,
        E: null,
      },
      limit: 30,
      result: `{ A: 1, D, B: true, <…2> }`,
    }
    const d = JSONOneliner.print(t.value, t.limit, true)
    expect(printData(d)).toBe(t.result)
    expect(d.availableSpace).toBe(t.limit - t.result.length)
  })

  it('should print all array values when enough space', () => {
    const t = {
      value: [[1, 2, 3], 'Lorem', ['a', 'b']],
      limit: 100,
      result: `[ [ 1, 2, 3 ], "Lorem", [ "a", "b" ] ]`,
    }
    const d = JSONOneliner.print(t.value, t.limit, true)
    expect(printData(d)).toBe(t.result)
    expect(d.availableSpace).toBe(t.limit - t.result.length)
  })

  it('should print all object values when enough space', () => {
    const t = {
      value: {
        A: [1, 2, 3],
        B: 'Lorem',
        C: { a: 1, b: 2 },
        D: { a: [1, { c: 3 }, 'a'], b: 2 },
        E: [1, { b: ['c', { d: 'e' }] }, 'a'],
      },
      limit: 140,
      result: `{ A: [ 1, 2, 3 ], B: "Lorem", C: { a: 1, b: 2 }, D: { a: [ 1, { c: 3 }, "a" ], b: 2 }, E: [ 1, { b: [ "c", { d: "e" } ] }, "a" ] }`,
    }
    const d = JSONOneliner.print(t.value, t.limit, true)
    expect(printData(d)).toBe(t.result)
    expect(d.availableSpace).toBe(t.limit - t.result.length)
  })

  it('should print placeholders instead object values when not enough space', () => {
    const t = {
      value: {
        A: [1, 2, 3],
        B: 'Lorem',
        C: { a: 1, b: 2 },
        D: { a: [1, { c: 3 }, 'a'], b: 2 },
        E: [1, { b: ['c', { d: 'e' }] }, 'a'],
      },
      steps: [
        {
          limit: 130,
          result: `{ A: [ 1, 2, 3 ], B: "Lorem", C: { a: 1, b: 2 }, D: { a: [ 1, { c: 3 }, "a" ], b: 2 }, E: [ 1, { b: [ "c", { <…1> } ] }, "a" ] }`,
        },
        {
          limit: 120,
          result: `{ A: [ 1, 2, 3 ], B: "Lorem", C: { a: 1, b: 2 }, D: { a: [ 1, { c: 3 }, "a" ], b: 2 }, E: [ 1, { b: [ <…2> ] }, "a" ] }`,
        },
        {
          limit: 110,
          // TODO: result is longer than limit (113)
          result: `{ A: [ 1, 2, 3 ], B: "Lorem", C: { a: 1, b: 2 }, D: { a: [ 1, { c: 3 }, "a" ], b: 2 }, E: [ 1, { <…1> }, <…1> ] }`,
        },
        {
          limit: 50,
          // TODO: result is longer than limit (59)
          result: `{ A: [ <…3> ], B: "Lorem", C: { <…2> }, D: { <…2> }, <…1> }`,
        },
      ],
    }

    const d0 = JSONOneliner.print(t.value, t.steps[0].limit, true)
    expect(printData(d0)).toBe(t.steps[0].result)
    expect(d0.availableSpace).toBe(t.steps[0].limit - t.steps[0].result.length)

    const d1 = JSONOneliner.print(t.value, t.steps[1].limit, true)
    expect(printData(d1)).toBe(t.steps[1].result)
    expect(d1.availableSpace).toBe(t.steps[1].limit - t.steps[1].result.length)

    const d2 = JSONOneliner.print(t.value, t.steps[2].limit, true)
    expect(printData(d2)).toBe(t.steps[2].result)
    expect(d2.availableSpace).toBe(t.steps[2].limit - t.steps[2].result.length)

    const d3 = JSONOneliner.print(t.value, t.steps[3].limit, true)
    expect(printData(d3)).toBe(t.steps[3].result)
    expect(d3.availableSpace).toBe(t.steps[3].limit - t.steps[3].result.length)
  })
})
