import { describe, it, expect } from 'vitest'

import * as Request from 'utils/useRequest'
import * as Workflows from 'utils/workflows'

import * as checks from './checks'

const workflow = (patch: Partial<Workflows.Workflow> = {}): Workflows.Workflow => ({
  isDefault: false,
  isDisabled: false,
  packageName: { files: '', packages: '' },
  packageNamePattern: null,
  slug: 'w',
  schemas: {},
  ...patch,
})

describe('containers/Bucket/Workflows/checks', () => {
  describe('checkSchema', () => {
    it('accepts a plain draft-07 schema', () => {
      expect(
        checks.checkSchema({
          $schema: 'http://json-schema.org/draft-07/schema#',
          type: 'object',
        }),
      ).toEqual([])
    })

    it('flags drafts and $ref that push rejects', () => {
      const problems = checks.checkSchema({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        properties: { a: { $ref: '#/definitions/a' } },
      })
      expect(problems[0]).toMatch('draft-07')
      expect(problems[1]).toMatch('$ref')
    })

    it('flags schemas that do not compile', () => {
      expect(checks.checkSchema({ type: 'nope' })[0]).toMatch("can't use")
    })

    it('flags non-objects', () => {
      expect(checks.checkSchema([])).toEqual(['Schema must be a JSON object'])
    })
  })

  describe('dryRun', () => {
    const schema = {
      type: 'object',
      required: ['a', 'b'],
      properties: { c: { type: 'number' } },
    }

    it('reports every metadata error with its path, not just the first', () => {
      const issues = checks.dryRun(workflow(), schema, {
        name: 'a/b',
        message: '',
        meta: { c: 'x' },
      })
      expect(issues.map((i) => i.path)).toEqual(['/a', '/b', '/c'])
    })

    it('checks name pattern and required message', () => {
      const issues = checks.dryRun(
        workflow({ packageNamePattern: /^lab\//, isMessageRequired: true }),
        undefined,
        { name: 'x/y', message: '', meta: {} },
      )
      expect(issues.map((i) => i.path)).toEqual(['message', 'name'])
    })

    it('accepts what push accepts: unknown formats and keywords', () => {
      expect(
        checks.checkSchema({
          type: 'object',
          properties: { e: { format: 'email', 'x-ui': 1 } },
        }),
      ).toEqual([])
    })

    it('does not fill defaults that push would not fill', () => {
      const issues = checks.dryRun(
        workflow(),
        { type: 'object', required: ['a'], properties: { a: { default: 1 } } },
        { name: 'a/b', message: '', meta: {} },
      )
      expect(issues.map((i) => i.path)).toEqual(['/a'])
    })

    it('ignores formats, as push does', () => {
      const issues = checks.dryRun(
        workflow(),
        { type: 'object', properties: { d: { type: 'string', format: 'date' } } },
        { name: 'a/b', message: '', meta: { d: 'not a date' } },
      )
      expect(issues).toEqual([])
    })

    it('fails the name when the pattern cannot be checked here', () => {
      const issues = checks.dryRun(
        workflow({ packageNamePatternError: 'x' }),
        undefined,
        { name: 'a/b', message: '', meta: {} },
      )
      expect(issues.map((i) => i.path)).toEqual(['name'])
    })

    it('checks the name format every push enforces', () => {
      const issues = checks.dryRun(workflow(), undefined, {
        name: 'foobar',
        message: '',
        meta: {},
      })
      expect(issues).toEqual([{ path: 'name', message: 'Invalid package name: foobar.' }])
      expect(
        checks.dryRun(workflow(), undefined, {
          name: 'lab-é/x_1',
          message: '',
          meta: {},
        }),
      ).toEqual([])
    })

    it('points additionalProperties errors at the property', () => {
      const issues = checks.dryRun(
        workflow(),
        { type: 'object', additionalProperties: false },
        { name: 'a/b', message: '', meta: { extra: 1 } },
      )
      expect(issues.map((i) => i.path)).toEqual(['/extra'])
    })

    it('passes valid input', () => {
      expect(
        checks.dryRun(workflow({ packageNamePattern: /^lab\// }), schema, {
          name: 'lab/y',
          message: 'm',
          meta: { a: 1, b: 2, c: 3 },
        }),
      ).toEqual([])
    })
  })

  describe('tryIt', () => {
    const withSchema = workflow({
      schema: { url: 's3://b/s.json' },
      packageNamePattern: /^lab\//,
    })
    const input = { name: 'x/y', message: '', metaText: '{}' }
    const schemas = (
      metadata: checks.SchemaResult,
    ): { metadata: checks.SchemaResult; entries: checks.SchemaResult } => ({
      metadata,
      entries: Request.Idle,
    })

    it('never passes while the metadata schema is loading, and still checks the name', () => {
      const issues = checks.tryIt(withSchema, schemas(Request.Loading), input)
      expect(issues.map((i) => i.path)).toEqual(['name', 'metadata'])
    })

    it('reports an unreadable or unusable schema instead of passing', () => {
      expect(
        checks.tryIt(withSchema, schemas(new Error('denied')), input)[1].message,
      ).toMatch('denied')
      expect(
        checks.tryIt(
          withSchema,
          schemas({ properties: { a: { $ref: '#/x' } } }),
          input,
        )[1].message,
      ).toMatch('$ref')
    })

    it('reports undefined schema ids and bad JSON alongside the name', () => {
      const issues = checks.tryIt(
        workflow({ undefinedSchemas: ['gone'], packageNamePattern: /^lab\// }),
        schemas(Request.Idle),
        { ...input, metaText: '{' },
      )
      expect(issues.map((i) => i.path)).toEqual(['name', 'workflow', 'metadata'])
    })

    it('validates metadata once the schema is ready', () => {
      const issues = checks.tryIt(
        withSchema,
        schemas({ type: 'object', required: ['a'] }),
        { ...input, name: 'lab/y' },
      )
      expect(issues).toEqual([{ path: '/a', message: "must have required property 'a'" }])
    })

    it('escapes property names as JSON Pointer tokens', () => {
      const issues = checks.tryIt(
        withSchema,
        schemas({ type: 'object', required: ['a/b~c'] }),
        { ...input, name: 'lab/y' },
      )
      expect(issues[0].path).toBe('/a~1b~0c')
    })
  })

  it('accepts boolean schemas the way push does', () => {
    expect(checks.checkSchema(true)).toEqual([])
    expect(checks.checkSchema(false)).toHaveLength(1)
  })
})
