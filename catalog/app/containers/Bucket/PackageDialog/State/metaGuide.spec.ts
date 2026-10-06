import type { ErrorObject } from 'ajv'
import { describe, it, expect } from 'vitest'

import { makeSchemaValidator } from 'utils/JSONSchema'

import { humanizeError, invalidKeys, requiredFields } from './metaGuide'

const schema = {
  type: 'object',
  required: ['project', 'assay'],
  properties: {
    project: { type: 'string', title: 'Project' },
    assay: { enum: ['rna', 'dna'], description: 'Assay type' },
    lab: { type: 'object', properties: { pi: { type: 'string' } } },
  },
}

const humanize = (value: unknown) =>
  (makeSchemaValidator(schema)(value) as ErrorObject[]).map(humanizeError)

describe('containers/Bucket/PackageDialog/State/metaGuide', () => {
  describe('humanizeError', () => {
    it('names missing required fields', () => {
      expect(humanize({ assay: 'rna' })).toEqual(['Required field "project" is missing'])
    })

    it('lists allowed enum values', () => {
      expect(humanize({ project: 'p', assay: 'x' })).toEqual([
        '"assay" must be one of: "rna", "dna"',
      ])
    })

    it('names nested fields with a type error', () => {
      expect(humanize({ project: 'p', assay: 'rna', lab: { pi: 1 } })).toEqual([
        '"lab.pi" must be a string',
      ])
    })

    it('words numeric and length limits', () => {
      const limits = {
        type: 'object',
        properties: { n: { minimum: 1 }, s: { maxLength: 2 } },
      }
      const errors = makeSchemaValidator(limits)({ n: 0, s: 'abc' }) as ErrorObject[]
      expect(errors.map(humanizeError)).toEqual([
        '"n" must be at least 1',
        '"s" must be at most 2 characters',
      ])
    })

    it('passes plain errors through', () => {
      expect(humanizeError(new Error('Schema is not ready'))).toBe('Schema is not ready')
    })
  })

  describe('requiredFields', () => {
    it('reports required fields with schema hints and fill state', () => {
      expect(requiredFields(schema, { project: 'p', assay: '' })).toEqual([
        {
          key: 'project',
          title: 'Project',
          description: undefined,
          filled: true,
          invalid: false,
        },
        {
          key: 'assay',
          title: undefined,
          description: 'Assay type',
          filled: false,
          invalid: false,
        },
      ])
    })

    it('counts a schema default as filled', () => {
      const withDefault = {
        required: ['project'],
        properties: { project: { type: 'string', default: 'p' } },
      }
      expect(requiredFields(withDefault, {})[0].filled).toBe(true)
    })

    it('marks a present value that fails the schema as invalid', () => {
      const invalid = invalidKeys(
        makeSchemaValidator(schema)({ project: 'p', assay: 'x' }) as ErrorObject[],
      )
      expect(invalid).toEqual(new Set(['assay']))
      const [project, assay] = requiredFields(
        schema,
        { project: 'p', assay: 'x' },
        invalid,
      )
      expect(project.invalid).toBe(false)
      expect(assay).toMatchObject({ filled: true, invalid: true })
    })

    it('is empty without a schema', () => {
      expect(requiredFields(undefined, {})).toEqual([])
    })
  })
})
