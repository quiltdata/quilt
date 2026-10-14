import { describe, expect, it } from 'vitest'

import tabulatorTableSchema from 'schemas/tabulatorTable.yml.json'
import { makeSchemaValidator } from 'utils/JSONSchema'

const validate = makeSchemaValidator(tabulatorTableSchema)

const config = (parser: object) => ({
  schema: [{ name: 'cell_id', type: 'STRING' }],
  source: { type: 'quilt-packages', package_name: '.*', logical_key: '\\.h5ad$' },
  parser,
})

describe('schemas/tabulatorTable.yml.json', () => {
  it('accepts an h5ad parser with a view and layer', () => {
    expect(validate(config({ format: 'h5ad', view: 'x', layer: 'raw' }))).toEqual([])
  })

  it('rejects a layer outside view x', () => {
    expect(validate(config({ format: 'h5ad', view: 'obs', layer: 'raw' }))).not.toEqual(
      [],
    )
    expect(validate(config({ format: 'h5ad', layer: 'raw' }))).toEqual([])
  })

  it('rejects an unknown h5ad view', () => {
    expect(validate(config({ format: 'h5ad', view: 'uns' }))).not.toEqual([])
  })
})
