import type { ErrorObject } from 'ajv'

import type { JsonSchema } from 'utils/JSONSchema'
import type * as Types from 'utils/types'

/** `/a/b/0` → `a.b[0]`, the way users name fields; empty for the root. */
function fieldName(instancePath: string): string {
  return instancePath
    .split('/')
    .slice(1)
    .map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce((acc, p) => (/^\d+$/.test(p) ? `${acc}[${p}]` : acc ? `${acc}.${p}` : p), '')
}

const list = (xs: unknown[]) => xs.map((x) => JSON.stringify(x)).join(', ')

const COMPARISON: Record<string, string> = {
  '>=': 'at least',
  '<=': 'at most',
  '>': 'greater than',
  '<': 'less than',
}

/**
 * Rewrites an ajv error as a sentence naming the field, instead of ajv's
 * `must have required property 'x'` under an empty instance path.
 */
export function humanizeError(e: Error | ErrorObject): string {
  if (!('keyword' in e)) return e.message
  const field = fieldName(e.instancePath)
  const at = field ? `"${field}"` : 'Metadata'
  const p = e.params as Record<string, any>
  switch (e.keyword) {
    case 'required': {
      const missing = field ? `${field}.${p.missingProperty}` : p.missingProperty
      return `Required field "${missing}" is missing`
    }
    case 'enum':
      return `${at} must be one of: ${list(p.allowedValues)}`
    case 'const':
      return `${at} must be ${JSON.stringify(p.allowedValue)}`
    case 'type':
      return `${at} must be ${/^[aeiou]/.test(p.type) ? 'an' : 'a'} ${p.type}`
    case 'format':
      return `${at} must be a valid ${p.format}`
    case 'pattern':
      return `${at} must match the pattern ${p.pattern}`
    case 'minimum':
    case 'maximum':
    case 'exclusiveMinimum':
    case 'exclusiveMaximum':
      return `${at} must be ${COMPARISON[p.comparison] ?? p.comparison} ${p.limit}`
    case 'minLength':
      return `${at} must be at least ${p.limit} characters`
    case 'maxLength':
      return `${at} must be at most ${p.limit} characters`
    case 'additionalProperties':
      return `${at} does not allow the field "${p.additionalProperty}"`
    default:
      return field ? `"${field}" ${e.message}` : e.message || 'Invalid metadata'
  }
}

export interface RequiredField {
  key: string
  title?: string
  description?: string
  filled: boolean
}

const isFilled = (v: unknown) => v !== undefined && v !== null && v !== ''

/**
 * Top-level fields the workflow schema requires, and whether `value` has them;
 * a schema default counts, since one is applied before validation and push.
 */
export function requiredFields(
  schema?: JsonSchema,
  value?: Types.JsonRecord,
): RequiredField[] {
  const required: unknown = schema?.required
  if (!Array.isArray(required)) return []
  return required
    .filter((k): k is string => typeof k === 'string')
    .map((key) => ({
      key,
      title: schema?.properties?.[key]?.title,
      description: schema?.properties?.[key]?.description,
      filled: isFilled(value?.[key] ?? schema?.properties?.[key]?.default),
    }))
}
