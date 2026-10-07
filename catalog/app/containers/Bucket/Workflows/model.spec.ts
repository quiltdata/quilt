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
    const loc = model.schemaLocation({}, 'b', draft(), 'x1')
    const next = model.applyFlow(undefined, draft({ fields, messageRequired: true }), loc)
    expect(next).toEqual({
      version: '1',
      is_workflow_required: false,
      workflows: {
        lab: { name: 'Lab', is_message_required: true, metadata_schema: 'lab' },
      },
      schemas: { lab: { url: 's3://b/.quilt/workflows/lab-x1.json' } },
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
    const loc = model.schemaLocation(config, 'b', draft(), 'x1')
    // `shared` is used by another flow, so this flow gets its own key and file
    expect(loc).toEqual({ key: 'lab', url: 's3://b/.quilt/workflows/lab-x1.json' })
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

  it('cleans and checks promote buckets, keeping keys it does not manage', () => {
    const config = { version: '1', successors: { 's3://gold': { title: 'G', extra: 1 } } }
    const next = model.applyPromote(config, [
      { bucket: ' s3://gold/ ', title: 'Gold', copyData: true },
    ])
    expect(next.successors).toEqual({ 's3://gold': { title: 'Gold', extra: 1 } })
    expect(
      model.validatePromote([{ bucket: 'Not A Bucket', title: '', copyData: true }]),
    ).toEqual({
      'promote.0': 'Not a valid bucket name',
    })
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
    expect(model.promoteFromConfig(next).map(({ stored: _s, ...p }) => p)).toEqual([
      { bucket: 'gold', title: 'Gold', copyData: false },
      { bucket: 'silver', title: 'silver', copyData: true },
    ])
    expect(model.applyPromote(next, [])).toEqual({ version: '1' })
  })

  it('accepts Python patterns but still catches broken ones', () => {
    const v = (namePattern: string, originalPattern?: string) =>
      model.validateDraft(draft({ namePattern }), {
        isNew: false,
        existingIds: [],
        originalPattern,
      }).namePattern
    expect(v('^(?P<lab>[a-z]+)/(?P=lab)$')).toBeUndefined()
    expect(v('(?i)^lab/')).toBeUndefined()
    expect(v('^lab/\\Z')).toBeUndefined()
    expect(v('^(?P<x')).toMatch("won't work")
    // unchanged patterns are left to the push
    expect(v('^(?P<x', '^(?P<x')).toBeUndefined()
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

  it('turns copying back on for a promote target', () => {
    const config = {
      version: '1',
      successors: { 's3://gold': { title: 'G', copy_data: false } },
    }
    expect(
      model.applyPromote(config, [{ bucket: 'gold', title: 'G', copyData: true }])
        .successors,
    ).toEqual({ 's3://gold': { title: 'G' } })
  })

  it('keeps schemas whose rules the builder would drop out of the builder', () => {
    const obj = (extra: object) => ({ type: 'object', ...extra })
    // required names a field with no property
    expect(
      model.schemaToFields(
        obj({ properties: { a: { type: 'string' } }, required: ['b'] }),
      ),
    ).toBe(null)
    // a date format the builder doesn't write
    expect(
      model.schemaToFields(
        obj({
          properties: { d: { type: 'string', format: 'date', dateformat: 'dd/MM/yyyy' } },
        }),
      ),
    ).toBe(null)
    // no fields at all
    expect(model.schemaToFields(obj({}))).toBe(null)
  })

  it('never rewrites an existing schema file', () => {
    const url = 's3://b/.quilt/workflows/a.json'
    const config = {
      version: '1',
      workflows: {
        a: { name: 'A', metadata_schema: 'a' },
        b: { name: 'B', metadata_schema: 'alias' },
      },
      schemas: { a: { url }, alias: { url } },
    }
    const loc = model.schemaLocation(config, 'b', draft({ id: 'a' }), 'x2')
    expect(loc).toEqual({ key: 'a', url: 's3://b/.quilt/workflows/a-x2.json' })
  })

  it('does not reuse a key the same flow uses for its entries', () => {
    const config = {
      version: '1',
      workflows: { a: { name: 'A', metadata_schema: 's1', entries_schema: 's1' } },
      schemas: { s1: { url: 's3://b/.quilt/workflows/s1.json' } },
    }
    expect(model.schemaLocation(config, 'b', draft({ id: 'a' }), 'x').key).not.toBe('s1')
  })

  it('checks patterns the way the catalog and the push read them', () => {
    const v = (namePattern: string) =>
      model.validateDraft(draft({ namePattern }), { isNew: true, existingIds: [] })
        .namePattern
    expect(v('^(?P<ns>lab)/')).toBeUndefined()
    expect(v('^lab\\-\\w+/')).toBeUndefined()
    expect(v('^\\p{L}+/')).toMatch("won't work")
    expect(v('(')).toMatch("won't work")
  })

  it('trims field names', () => {
    const fs: model.Field[] = [
      { name: 'id ', type: 'text', required: true, options: [] },
      { name: 'id', type: 'text', required: true, options: [] },
    ]
    expect(
      model.validateDraft(draft({ fields: fs }), { isNew: true, existingIds: [] }),
    ).toEqual({
      'fields.1': 'Field names must be unique',
    })
    expect(model.fieldsToSchema([fs[0]])).toMatchObject({
      properties: { id: {} },
      required: ['id'],
    })
  })

  it('drops the deleted flow’s schema entries nothing else uses', () => {
    const config = {
      version: '1',
      workflows: {
        a: { name: 'A', metadata_schema: 'a' },
        b: { name: 'B', metadata_schema: 'shared' },
        c: { name: 'C', metadata_schema: 'shared' },
      },
      schemas: { a: { url: 's3://b/a.json' }, shared: { url: 's3://b/s.json' } },
    }
    expect(model.removeFlow(config, 'a').schemas).toEqual({
      shared: { url: 's3://b/s.json' },
    })
    expect(model.removeFlow(config, 'b').schemas).toEqual(config.schemas)
  })

  it('moves off a schema key shared with other rules even when it equals the flow id', () => {
    const shared = {
      version: '1',
      workflows: {
        qc: { name: 'QC', metadata_schema: 'qc' },
        other: { name: 'O', metadata_schema: 'qc' },
      },
      schemas: { qc: { url: 's3://b/.quilt/workflows/qc.json' } },
    }
    expect(model.schemaLocation(shared, 'b', draft({ id: 'qc' }), 'x').key).toBe('qc-2')
    const ownEntries = {
      version: '1',
      workflows: { qc: { name: 'QC', metadata_schema: 'qc', entries_schema: 'qc' } },
      schemas: { qc: { url: 's3://b/.quilt/workflows/qc.json' } },
    }
    expect(model.schemaLocation(ownEntries, 'b', draft({ id: 'qc' }), 'x').key).toBe(
      'qc-2',
    )
  })

  it('accepts Python anchors next to \\d without blocking the save', () => {
    expect(
      model.validateDraft(draft({ namePattern: '\\A\\d+$' }), {
        isNew: true,
        existingIds: [],
      }).namePattern,
    ).toBeUndefined()
  })

  it('flags a promote bucket listed twice and keeps successor paths', () => {
    expect(
      model.validatePromote([
        { bucket: 's3://prod/', title: 'Prod', copyData: true },
        { bucket: 'prod', title: 'Prod (no copy)', copyData: false },
      ]),
    ).toEqual({ 'promote.1': 'This bucket is already listed' })
    const config = {
      version: '1',
      successors: { 's3://prod/sub/': { title: 'Sub', extra: 1 } },
    }
    expect(
      model.applyPromote(config, model.promoteFromConfig(config)).successors,
    ).toEqual(config.successors)
  })

  it('keeps a successor key with a trailing slash and its extra keys', () => {
    const config = {
      version: '1',
      successors: { 's3://prod/': { title: 'P', extra: 1 } },
    }
    expect(
      model.applyPromote(config, model.promoteFromConfig(config)).successors,
    ).toEqual(config.successors)
  })

  it('trims the name pattern', () => {
    const next = model.applyFlow(undefined, draft({ namePattern: ' ^lab/ ' }), null)
    expect(next.workflows.lab.handle_pattern).toBe('^lab/')
  })

  it('keeps an empty-enum schema out of the builder', () => {
    expect(
      model.schemaToFields({
        type: 'object',
        properties: { a: { type: 'string', enum: [] } },
      }),
    ).toBe(null)
  })

  it('leaves stored successor keys alone, even ones that look alike', () => {
    const config = {
      version: '1',
      successors: { 's3://prod': { title: 'A' }, 's3://prod/': { title: 'B', extra: 1 } },
    }
    const promote = model.promoteFromConfig(config)
    expect(model.validatePromote(promote)).toEqual({})
    expect(model.applyPromote(config, promote).successors).toEqual(config.successors)
  })

  it('validates the pattern as it will be saved', () => {
    expect(
      model.validateDraft(draft({ namePattern: 'foo\\ ' }), {
        isNew: true,
        existingIds: [],
      }).namePattern,
    ).toMatch("won't work")
  })

  it('flags a new promote row that duplicates a stored one, so nothing is lost', () => {
    const config = { version: '1', successors: { 's3://prod/': { title: 'Prod' } } }
    const promote = [
      ...model.promoteFromConfig(config),
      { bucket: 'prod', title: 'Again', copyData: true },
    ]
    expect(model.validatePromote(promote)).toEqual({
      'promote.1': 'This bucket is already listed',
    })
  })

  it('never writes two rows to one key', () => {
    const config = {
      version: '1',
      successors: { 's3://prod/': { title: 'P', extra: 1 } },
    }
    const [stored] = model.promoteFromConfig(config)
    const next = model.applyPromote(config, [
      stored,
      { bucket: 'other', title: 'O', copyData: true },
    ])
    expect(Object.keys(next.successors)).toEqual(['s3://prod/', 's3://other'])
    // An edited stored row keeps its extras when nothing else uses the old entry
    const edited = model.applyPromote(config, [{ ...stored, bucket: 'prod' }])
    expect(edited.successors).toEqual({ 's3://prod/': { title: 'P', extra: 1 } })
  })
})
