import type { ErrorObject } from 'ajv'

import { JsonSchema, makeSchemaValidator } from 'utils/JSONSchema'
import type * as Types from 'utils/types'
import * as Workflows from 'utils/workflows'

// quilt3 accepts only these, so a schema the catalog can validate may still be rejected on
// push: see `SUPPORTED_META_SCHEMAS` and `_schema_load_object_hook` in quilt3/workflows.
const DRAFT_07 = 'http://json-schema.org/draft-07/schema#'

// quilt3's jsonschema ignores unknown keywords and formats and doesn't fill defaults, so ajv
// must not be stricter (or more lenient) than the push.
const AJV_LIKE_PUSH = { strict: false, useDefaults: false, validateFormats: false }

export interface Issue {
  path: string
  message: string
}

function hasRef(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasRef)
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([k, v]) => k === '$ref' || hasRef(v))
  }
  return false
}

export function checkSchema(schema: unknown): string[] {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return ['Schema must be a JSON object']
  }
  const problems: string[] = []
  const meta = (schema as JsonSchema).$schema
  if (meta !== undefined && meta !== DRAFT_07) {
    problems.push(`Unsupported $schema "${meta}": push accepts only draft-07`)
  }
  if (hasRef(schema)) {
    problems.push('Schema uses $ref, which push rejects')
  }
  const compileError = makeSchemaValidator(
    schema as JsonSchema,
    undefined,
    AJV_LIKE_PUSH,
  )({}).find((e): e is Error => e instanceof Error)
  if (compileError)
    problems.push(`Catalog can't use this schema: ${compileError.message}`)
  return problems
}

function toIssue(e: ErrorObject | Error): Issue {
  if (e instanceof Error) return { path: '', message: e.message }
  const missing = e.keyword === 'required' ? `/${e.params.missingProperty}` : ''
  return {
    path: `${e.instancePath}${missing}` || '/',
    message: e.message || 'is invalid',
  }
}

interface DryRunInput {
  name: string
  message: string
  meta: Types.Json
}

// Same checks, order and wording as quilt3 `WorkflowValidator.validate`, but reports every
// metadata error with its location instead of stopping at the first.
export function dryRun(
  workflow: Workflows.Workflow,
  metadataSchema: JsonSchema | undefined,
  { name, message, meta }: DryRunInput,
): Issue[] {
  const issues: Issue[] = []
  if (workflow.isMessageRequired && !message) {
    issues.push({
      path: 'message',
      message: 'Commit message is required by workflow, but none was provided.',
    })
  }
  if (workflow.packageNamePatternError) {
    issues.push({
      path: 'name',
      message: `Name pattern can't be checked in the browser (${workflow.packageNamePatternError}); push still enforces it.`,
    })
  } else if (workflow.packageNamePattern && !workflow.packageNamePattern.test(name)) {
    issues.push({ path: 'name', message: "Package name doesn't match required pattern." })
  }
  if (metadataSchema) {
    issues.push(
      ...makeSchemaValidator(
        metadataSchema,
        undefined,
        AJV_LIKE_PUSH,
      )(meta ?? {}).map(toIssue),
    )
  }
  return issues
}
