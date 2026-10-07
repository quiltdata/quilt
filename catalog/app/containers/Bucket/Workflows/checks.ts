import type { ErrorObject } from 'ajv'

import { JsonSchema, makeSchemaValidator } from 'utils/JSONSchema'
import type * as Types from 'utils/types'
import * as Request from 'utils/useRequest'
import * as Workflows from 'utils/workflows'

// quilt3 accepts only these, so a schema the catalog can validate may still be rejected on
// push: see `SUPPORTED_META_SCHEMAS` and `_schema_load_object_hook` in quilt3/workflows.
export const DRAFT_07 = 'http://json-schema.org/draft-07/schema#'

// quilt3's jsonschema ignores unknown keywords and formats and doesn't fill defaults, so ajv
// must not be stricter (or more lenient) than the push.
// Schema `pattern`s run with Python `re` on push: translate them like name patterns, and
// let ones the browser can't reproduce pass here (push still enforces them).
const pythonRegExp = (source: string) => {
  const a = Workflows.analyzePattern(source)
  return a._tag === 'ok' ? a.regex : { test: () => true }
}
pythonRegExp.code = 'pythonRegExp'

const AJV_LIKE_PUSH = {
  strict: false,
  useDefaults: false,
  validateFormats: false,
  code: { regExp: pythonRegExp },
}

// quilt3 `PACKAGE_NAME_FORMAT` checked on every push; Python's `\w` is Unicode-aware.
const PACKAGE_NAME_FORMAT = new RegExp('^[\\p{L}\\p{N}_-]+/[\\p{L}\\p{N}_-]+$', 'u')

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

// Try it runs on every keystroke; compile each loaded schema once.
const validators = new WeakMap<object, ReturnType<typeof makeSchemaValidator>>()
function validatorFor(schema: JsonSchema) {
  let v = validators.get(schema)
  if (!v) {
    v = makeSchemaValidator(schema, undefined, AJV_LIKE_PUSH)
    validators.set(schema, v)
  }
  return v
}

export function checkSchema(schema: unknown): string[] {
  // draft-07 boolean schemas load on push: `true` accepts anything, `false` nothing.
  if (schema === true) return []
  if (schema === false) return ['Schema is `false`, so push rejects every package']
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
  const compileError = validatorFor(schema as JsonSchema)({}).find(
    (e): e is Error => e instanceof Error,
  )
  if (compileError)
    problems.push(`Catalog can't use this schema: ${compileError.message}`)
  return problems
}

const pointerToken = (name: string) => `/${name.replace(/~/g, '~0').replace(/\//g, '~1')}`

function toIssue(e: ErrorObject | Error): Issue {
  if (e instanceof Error) return { path: '', message: e.message }
  const prop =
    e.keyword === 'required'
      ? pointerToken(e.params.missingProperty)
      : e.keyword === 'additionalProperties'
        ? pointerToken(e.params.additionalProperty)
        : ''
  return {
    path: `${e.instancePath}${prop}` || '/',
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
  if (!PACKAGE_NAME_FORMAT.test(name)) {
    issues.push({ path: 'name', message: `Invalid package name: ${name}.` })
  } else if (workflow.packageNamePatternInvalid) {
    issues.push({
      path: 'name',
      message: `This flow's name pattern is broken (${workflow.packageNamePatternInvalid}), so every push with it fails.`,
    })
  } else if (workflow.packageNamePatternError) {
    issues.push({
      path: 'name',
      message: `Name pattern can't be checked in the browser (${workflow.packageNamePatternError}); push still enforces it.`,
    })
  } else if (workflow.packageNamePattern && !workflow.packageNamePattern.test(name)) {
    issues.push({ path: 'name', message: "Package name doesn't match required pattern." })
  }
  if (metadataSchema) {
    issues.push(...validatorFor(metadataSchema)(meta ?? {}).map(toIssue))
  }
  return issues
}

export type SchemaResult = Request.Result<JsonSchema | null>

// Problems that fail every push before name, message or metadata are looked at.
function schemaIssues(
  label: string,
  url: string | undefined,
  result: SchemaResult,
): Issue[] {
  if (!url) return []
  if (result === Request.Idle || result === Request.Loading) {
    return [{ path: label, message: `Loading the ${label} schema…` }]
  }
  if (result instanceof Error) {
    return [{ path: label, message: `Can't read the ${label} schema: ${result.message}` }]
  }
  return checkSchema(result).map((message) => ({ path: label, message }))
}

interface TryItInput {
  name: string
  message: string
  metaText: string
}

// Fails closed: a schema push can't use never reads as "passes", and name and message
// rules, which don't depend on schemas, are always reported.
export function tryIt(
  workflow: Workflows.Workflow,
  schemas: { metadata: SchemaResult; entries: SchemaResult },
  { name, message, metaText }: TryItInput,
): Issue[] {
  const blocking: Issue[] = [
    ...(workflow.undefinedSchemas || []).map((id) => ({
      path: 'workflow',
      message: `There is no '${id}' in schemas.`,
    })),
    ...schemaIssues('metadata', workflow.schema?.url, schemas.metadata),
    ...schemaIssues('entries', workflow.entriesSchema, schemas.entries),
  ]
  let meta: Types.Json = {}
  try {
    meta = JSON.parse(metaText || '{}')
  } catch {
    blocking.push({ path: 'metadata', message: 'Metadata is not valid JSON' })
  }
  if (blocking.length) {
    return [...dryRun(workflow, undefined, { name, message, meta: {} }), ...blocking]
  }
  const schema = schemas.metadata
  return dryRun(
    workflow,
    schema && typeof schema === 'object' && !(schema instanceof Error)
      ? schema
      : undefined,
    {
      name,
      message,
      meta,
    },
  )
}
