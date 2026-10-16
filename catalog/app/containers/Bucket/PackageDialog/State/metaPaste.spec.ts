import { describe, expect, it } from 'vitest'

import { parsePastedFields } from './metaPaste'

const schema = {
  type: 'object',
  properties: {
    sample_count: { type: 'integer' },
    ratio: { type: 'number' },
    paired: { type: 'boolean' },
    project: { type: 'string' },
  },
}

describe('containers/Bucket/PackageDialog/State/metaPaste', () => {
  it('reads name/value rows, typed by the schema, and drops a header row', () => {
    const text =
      'Field\tValue\r\nproject\tONC-104\nsample_count\t24\nratio\t0.5\npaired\tTRUE\nlab\t007\n'
    expect(parsePastedFields(text, schema)).toEqual({
      fields: {
        project: 'ONC-104',
        sample_count: 24,
        ratio: 0.5,
        paired: true,
        lab: '007',
      },
      skipped: [],
    })
  })

  it('keeps tabs inside the value', () => {
    expect(parsePastedFields('notes\ta\tb', schema).fields).toEqual({ notes: 'a\tb' })
  })

  it('keeps a non-integer in an integer field as text, so validation flags it', () => {
    expect(parsePastedFields('sample_count\t2.5', schema).fields).toEqual({
      sample_count: '2.5',
    })
  })

  it('skips lines without a value, a reserved name, or a number it would round', () => {
    const text = 'project\nsample_count\t9007199254740993\n__proto__\tx\nratio\t1e-400'
    expect(parsePastedFields(text, schema)).toEqual({
      fields: {},
      skipped: [
        'project',
        'sample_count\t9007199254740993',
        '__proto__\tx',
        'ratio\t1e-400',
      ],
    })
  })

  it('keeps a field named after an Object member as an own key', () => {
    const { fields } = parsePastedFields('constructor\tx', schema)
    expect(Object.hasOwn(fields, 'constructor')).toBe(true)
  })
})
