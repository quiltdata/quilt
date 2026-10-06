import type { ErrorObject } from 'ajv'

import { JsonSchema, makeSchemaValidator } from 'utils/JSONSchema'
import type * as Types from 'utils/types'
import * as Workflows from 'utils/workflows'

// quilt3 accepts only these, so a schema the catalog can validate may still be rejected on
// push: see `SUPPORTED_META_SCHEMAS` and `_schema_load_object_hook` in quilt3/workflows.
const DRAFT_07 = 'http://json-schema.org/draft-07/schema#'

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
  const compileError = makeSchemaValidator(schema as JsonSchema)({}).find(
    (e): e is Error => e instanceof Error,
  )
  if (compileError) problems.push(`Schema does not compile: ${compileError.message}`)
  return problems
}

const toIssue = (e: ErrorObject | Error): Issue =>
  e instanceof Error
    ? { path: '', message: e.message }
    : { path: e.instancePath || '/', message: e.message || 'is invalid' }

interface DryRunInput {
  name: string
  message: string
  meta: Types.Json
}

// Mirrors the order and wording of quilt3 `WorkflowValidator.validate`, but reports every
// metadata error with its location instead of stopping at the first.
export function dryRun(
  workflow: Workflows.Workflow,
  metadataSchema: JsonSchema | undefined,
  { name, message, meta }: DryRunInput,
): Issue[] {
  const issues: Issue[] = []
  if (workflow.isMessageRequired && !message) {
    issues.push({ path: 'message', message: 'Commit message is required by workflow' })
  }
  if (workflow.packageNamePattern && !workflow.packageNamePattern.test(name)) {
    issues.push({
      path: 'name',
      message: `Package name doesn't match ${workflow.packageNamePattern}`,
    })
  }
  if (metadataSchema) {
    issues.push(...makeSchemaValidator(metadataSchema)(meta ?? {}).map(toIssue))
  }
  return issues
}
