import type { ErrorObject } from 'ajv'

import type { JsonSchema } from 'utils/JSONSchema'
import type * as Types from 'utils/types'

/** JSON pointer (RFC 6901) for a top-level key: `a/b` → `/a~1b`. */
export const pointer = (key: string) => `/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`

const unescape = (segment: string) => segment.replace(/~1/g, '/').replace(/~0/g, '~')

/** The top-level key an instance path points into; empty for the root. */
export const topKey = (instancePath: string) => unescape(instancePath.split('/')[1] ?? '')

// quilt3 and quilt-rs treat `format` as an annotation, so the registry accepts
// such values; blocking on them would refuse pushes that succeed.
export const isAdvisoryError = (e: Error | ErrorObject): e is ErrorObject =>
  'keyword' in e && e.keyword === 'format'

/** `/a/b/0` → `a.b[0]`, the way users name fields; empty for the root. */
function fieldName(instancePath: string): string {
  return instancePath
    .split('/')
    .slice(1)
    .map(unescape)
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

/**
 * The same error as `humanizeError`, worded for a message shown under its own
 * labelled input, so it does not repeat the field's name.
 */
export function fieldMessage(e: Error | ErrorObject): string {
  if (!('keyword' in e)) return e.message
  const p = e.params as Record<string, any>
  switch (e.keyword) {
    case 'required':
      return 'Required'
    case 'enum':
      return `Choose one of: ${p.allowedValues.map((v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v))).join(', ')}`
    case 'const':
      return `Must be ${JSON.stringify(p.allowedValue)}`
    case 'type':
      if (p.type === 'integer') return 'Must be a whole number'
      if (p.type === 'number') return 'Must be a number'
      return `Must be ${/^[aeiou]/.test(p.type) ? 'an' : 'a'} ${p.type}`
    case 'format':
      return p.format === 'date'
        ? 'Use the format YYYY-MM-DD'
        : `Must be a valid ${p.format}`
    case 'pattern':
      return 'Does not match the expected format'
    case 'minimum':
      return `Must be at least ${p.limit}`
    case 'maximum':
      return `Must be at most ${p.limit}`
    case 'exclusiveMinimum':
      return `Must be more than ${p.limit}`
    case 'exclusiveMaximum':
      return `Must be less than ${p.limit}`
    case 'minLength':
      return `Must be at least ${p.limit} characters`
    case 'maxLength':
      return `Must be at most ${p.limit} characters`
    default:
      return e.message
        ? e.message.charAt(0).toUpperCase() + e.message.slice(1)
        : 'Invalid value'
  }
}

export interface RequiredField {
  key: string
  title?: string
  description?: string
  filled: boolean
  /** Has a value, but the value fails the schema. */
  invalid: boolean
}

/** Top-level keys that blocking errors point into, e.g. `/assay` → `assay`. */
export function invalidKeys(errors: (Error | ErrorObject)[]): Set<string> {
  const keys = new Set<string>()
  for (const e of errors) {
    if (!('keyword' in e) || e.keyword === 'format') continue
    const top = topKey(e.instancePath)
    if (top) keys.add(top)
  }
  return keys
}

export const isFilled = (v: unknown) => v !== undefined && v !== null && v !== ''

/** Whether `v` is a real value for `prop`: null and "" count only when the schema allows them. */
export function hasValue(v: unknown, prop: JsonSchema = {}): boolean {
  if (v === undefined) return false
  if (v !== null && v !== '') return true
  if (Array.isArray(prop.enum)) {
    return prop.enum.some((e: unknown) => JSON.stringify(e) === JSON.stringify(v))
  }
  const types: unknown[] = Array.isArray(prop.type) ? prop.type : [prop.type]
  return v === null && types.includes('null')
}

/**
 * Top-level fields the workflow schema requires, and whether `value` has them;
 * a schema default counts, since one is applied before validation and push.
 */
export function requiredFields(
  schema?: JsonSchema,
  value?: Types.JsonRecord,
  invalid: Set<string> = new Set(),
): RequiredField[] {
  const required: unknown = schema?.required
  if (!Array.isArray(required)) return []
  return required
    .filter((k): k is string => typeof k === 'string')
    .map((key) => ({
      key,
      title: schema?.properties?.[key]?.title,
      description: schema?.properties?.[key]?.description,
      filled: hasValue(
        value && Object.hasOwn(value, key)
          ? value[key]
          : schema?.properties?.[key]?.default,
        schema?.properties?.[key],
      ),
      invalid: value?.[key] !== undefined && invalid.has(key),
    }))
}
