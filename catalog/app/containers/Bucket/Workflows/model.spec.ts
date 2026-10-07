import { describe, it, expect } from 'vitest'

import { makeSchemaValidator } from 'utils/JSONSchema'

import * as checks from './checks'
import * as model from './model'

const draft = (patch: Partial<model.FlowDraft> = {}): model.FlowDraft => ({
  id: 'lab',
  name: 'Lab',
  description: '',
  namePattern: '',
  messageRequired: false,
  fields: [],
  ...patch,
})

const fields: model.Field[] = [
  { name: 'study', type: 'text', required: true, options: [] },
  { name: 'n', type: 'integer', required: false, options: [] },
  { name: 'when', type: 'date', required: true, options: [] },
  { name: 'stage', type: 'choice', required: true, options: ['raw', 'final'] },
]

describe('containers/Bucket/Workflows/model', () => {
  it('builds a schema push accepts and reads it back unchanged', () => {
    const schema = model.fieldsToSchema(fields)
    expect(checks.checkSchema(schema)).toEqual([])
    expect(model.schemaToFields(schema)).toEqual(fields)
    const errors = makeSchemaValidator(schema)({ n: 1.5, stage: 'x' })
    expect(errors.length).toBeGreaterThan(0)
  })

  it('keeps schemas the builder cannot show out of the builder', () => {
    expect(
      model.schemaToFields({ type: 'object', properties: { a: { type: 'array' } } }),
    ).toBe(null)
    expect(
      model.schemaToFields({ type: 'object', properties: { a: { $ref: '#/x' } } }),
    ).toBe(null)
    expect(model.schemaToFields({ type: 'object', additionalProperties: false })).toBe(
      null,
    )
  })

  it('starts fields from a package’s metadata', () => {
    expect(
      model
        .fieldsFromMeta({ a: 'x', d: '2026-10-07', n: 3, f: 0.5, b: true, o: {} })
        .map((f) => [f.name, f.type]),
    ).toEqual([
      ['a', 'text'],
      ['d', 'date'],
      ['n', 'integer'],
      ['f', 'number'],
      ['b', 'boolean'],
    ])
  })

  it('makes ids quilt3 accepts', () => {
    expect(model.slugify(' Raw Data: v2 ')).toBe('raw-data-v2')
    expect(model.slugify('2026 intake')).toBe('flow-2026-intake')
    expect(model.slugify('!!!')).toBe('flow')
  })

  it('writes a new flow and its schema into an empty bucket', () => {
    const loc = model.schemaLocation({}, 'b', draft())
    const next = model.applyFlow(undefined, draft({ fields, messageRequired: true }), loc)
    expect(next).toEqual({
      version: '1',
      is_workflow_required: false,
      workflows: {
        lab: { name: 'Lab', is_message_required: true, metadata_schema: 'lab' },
      },
      schemas: { lab: { url: 's3://b/.quilt/workflows/lab.json' } },
    })
  })

  it('edits a flow without dropping what the editor does not manage', () => {
    const config = {
      version: { base: '1', catalog: '1' },
      default_workflow: 'lab',
      workflows: {
        lab: {
          name: 'Old',
          metadata_schema: 'shared',
          entries_schema: 'e',
          catalog: { x: 1 },
        },
        other: { name: 'Other', metadata_schema: 'shared' },
      },
      schemas: {
        shared: { url: 's3://b/.quilt/workflows/shared.json' },
        e: { url: 's3://b/e' },
      },
    }
    const loc = model.schemaLocation(config, 'b', draft())
    // `shared` is used by another flow, so this flow gets its own file
    expect(loc).toEqual({ key: 'lab', url: 's3://b/.quilt/workflows/lab.json' })
    const next = model.applyFlow(config, draft({ name: 'New', fields }), loc)
    expect(next.workflows.lab).toEqual({
      name: 'New',
      entries_schema: 'e',
      catalog: { x: 1 },
      metadata_schema: 'lab',
    })
    expect(next.workflows.other).toEqual(config.workflows.other)
    expect(next.schemas.shared).toEqual(config.schemas.shared)
    expect(next.default_workflow).toBe('lab')
  })

  it('leaves an advanced schema reference alone', () => {
    const config = {
      version: '1',
      workflows: { lab: { name: 'Lab', metadata_schema: 'adv' } },
      schemas: { adv: { url: 's3://elsewhere/adv.json' } },
    }
    const next = model.applyFlow(
      config,
      draft({ fields: null, namePattern: '^lab/' }),
      null,
    )
    expect(next.workflows.lab).toEqual({
      name: 'Lab',
      handle_pattern: '^lab/',
      metadata_schema: 'adv',
    })
  })

  it('removes the config when the last flow goes', () => {
    const config = { version: '1', workflows: { a: { name: 'A' }, b: { name: 'B' } } }
    expect(model.removeFlow(config, 'a')).toEqual({
      version: '1',
      workflows: { b: { name: 'B' } },
    })
    expect(model.removeFlow({ version: '1', workflows: { a: { name: 'A' } } }, 'a')).toBe(
      null,
    )
  })

  it('round-trips promote targets', () => {
    const promote = [
      { bucket: 'gold', title: 'Gold', copyData: false },
      { bucket: 'silver', title: '', copyData: true },
    ]
    const next = model.applyPromote({ version: '1' }, promote)
    expect(next.successors).toEqual({
      's3://gold': { title: 'Gold', copy_data: false },
      's3://silver': { title: 'silver' },
    })
    expect(model.promoteFromConfig(next)).toEqual([
      { bucket: 'gold', title: 'Gold', copyData: false },
      { bucket: 'silver', title: 'silver', copyData: true },
    ])
    expect(model.applyPromote(next, [])).toEqual({ version: '1' })
  })

  it('validates drafts before saving', () => {
    const errors = model.validateDraft(
      draft({
        name: ' ',
        namePattern: '(',
        fields: [
          { name: 'a', type: 'choice', required: true, options: [] },
          { name: 'a', type: 'text', required: true, options: [] },
        ],
      }),
      { isNew: true, existingIds: [] },
    )
    expect(Object.keys(errors).sort()).toEqual([
      'fields.0',
      'fields.1',
      'name',
      'namePattern',
    ])
  })
})
