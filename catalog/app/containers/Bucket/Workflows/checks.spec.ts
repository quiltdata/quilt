import { describe, it, expect } from 'vitest'

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
})
