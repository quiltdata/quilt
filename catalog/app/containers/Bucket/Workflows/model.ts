import type { JsonSchema } from 'utils/JSONSchema'
import * as s3paths from 'utils/s3paths'
import type * as Types from 'utils/types'

// The app writes `.quilt/workflows/config.yml` and schema files for the user, so nobody
// edits YAML or JSON by hand. Anything here must stay valid for quilt3's config schema.

const DRAFT_07 = 'http://json-schema.org/draft-07/schema#'

export type FieldType = 'text' | 'number' | 'integer' | 'boolean' | 'date' | 'choice'

export interface Field {
  name: string
  type: FieldType
  required: boolean
  options: string[]
}

export interface Promote {
  bucket: string
  title: string
  copyData: boolean
}

export interface FlowDraft {
  id: string
  name: string
  description: string
  namePattern: string
  messageRequired: boolean
  // `null`: the schema uses features the builder can't show, so it is kept as is.
  fields: Field[] | null
}

type RawConfig = Record<string, any>

export const emptyField = (): Field => ({
  name: '',
  type: 'text',
  required: true,
  options: [],
})

export function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
  // quilt3 requires ids matching ^[A-Za-z_-][A-Za-z0-9_-]*$
  return /^[0-9]/.test(slug) ? `flow-${slug}`.slice(0, 64) : slug || 'flow'
}

function fieldSchema(f: Field): JsonSchema {
  switch (f.type) {
    case 'date':
      return { type: 'string', format: 'date', dateformat: 'yyyy-MM-dd' }
    case 'choice':
      return { type: 'string', enum: f.options }
    case 'text':
      return { type: 'string' }
    default:
      return { type: f.type }
  }
}

export function fieldsToSchema(fields: Field[]): JsonSchema {
  const required = fields.filter((f) => f.required).map((f) => f.name)
  return {
    $schema: DRAFT_07,
    type: 'object',
    properties: Object.fromEntries(fields.map((f) => [f.name, fieldSchema(f)])),
    ...(required.length ? { required } : {}),
  }
}

const SCHEMA_KEYS = new Set(['$schema', 'type', 'properties', 'required'])

function propertyToField(name: string, p: any, required: boolean): Field | null {
  if (!p || typeof p !== 'object') return null
  const keys = Object.keys(p)
  const base = { name, required, options: [] as string[] }
  if (p.type === 'string' && keys.every((k) => k === 'type' || k === 'enum')) {
    if (!p.enum) return { ...base, type: 'text' }
    if (Array.isArray(p.enum) && p.enum.every((o: unknown) => typeof o === 'string')) {
      return { ...base, type: 'choice', options: p.enum }
    }
    return null
  }
  if (
    p.type === 'string' &&
    p.format === 'date' &&
    keys.every((k) => ['type', 'format', 'dateformat'].includes(k))
  ) {
    return { ...base, type: 'date' }
  }
  if (['number', 'integer', 'boolean'].includes(p.type) && keys.length === 1) {
    return { ...base, type: p.type }
  }
  return null
}

// Reads a schema back into builder fields, or `null` if editing it in the builder would
// drop something (nested objects, arrays, patterns, $ref, ...).
export function schemaToFields(schema: unknown): Field[] | null {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return null
  const s = schema as JsonSchema
  if (!Object.keys(s).every((k) => SCHEMA_KEYS.has(k))) return null
  if (s.$schema !== undefined && s.$schema !== DRAFT_07) return null
  if (s.type !== 'object') return null
  const required: unknown = s.required ?? []
  if (!Array.isArray(required)) return null
  const fields: Field[] = []
  for (const [name, p] of Object.entries(s.properties ?? {})) {
    const f = propertyToField(name, p, required.includes(name))
    if (!f) return null
    fields.push(f)
  }
  return fields
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// "Start from a package": one field per top-level metadata value of a simple type.
export function fieldsFromMeta(meta: Types.Json): Field[] {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return []
  return Object.entries(meta).flatMap(([name, v]): Field[] => {
    const base = { name, required: true, options: [] }
    if (typeof v === 'boolean') return [{ ...base, type: 'boolean' }]
    if (typeof v === 'number') {
      return [{ ...base, type: Number.isInteger(v) ? 'integer' : 'number' }]
    }
    if (typeof v === 'string')
      return [{ ...base, type: DATE_RE.test(v) ? 'date' : 'text' }]
    return []
  })
}

export function validateDraft(
  draft: FlowDraft,
  { isNew, existingIds }: { isNew: boolean; existingIds: string[] },
): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!draft.name.trim()) errors.name = 'Give the flow a name'
  if (isNew && existingIds.includes(draft.id)) {
    errors.name = 'A flow with this name already exists'
  }
  if (draft.namePattern) {
    try {
      new RegExp(draft.namePattern)
    } catch (e) {
      errors.namePattern = 'This pattern is not valid'
    }
  }
  const names = new Set<string>()
  draft.fields?.forEach((f, i) => {
    if (!f.name.trim()) errors[`fields.${i}`] = 'Name this field'
    else if (names.has(f.name)) errors[`fields.${i}`] = 'Field names must be unique'
    else if (f.type === 'choice' && !f.options.length) {
      errors[`fields.${i}`] = 'Add at least one choice'
    }
    names.add(f.name)
  })
  return errors
}

export const schemaUrl = (bucket: string, id: string) =>
  `s3://${bucket}/.quilt/workflows/${encodeURIComponent(id)}.json`

// Returns the schema location to write, reusing the flow's own schema file when it has one.
export function schemaLocation(config: RawConfig, bucket: string, draft: FlowDraft) {
  const current = config.workflows?.[draft.id]?.metadata_schema
  const currentUrl = current && config.schemas?.[current]?.url
  const sharedWithOthers = Object.entries(config.workflows ?? {}).some(
    ([id, w]: [string, any]) => id !== draft.id && w?.metadata_schema === current,
  )
  if (currentUrl && !sharedWithOthers) {
    const loc = s3paths.parseS3Url(currentUrl)
    if (loc.bucket === bucket)
      return { key: current as string, url: currentUrl as string }
  }
  let key = draft.id
  for (
    let n = 2;
    config.schemas?.[key] && config.schemas[key].url !== schemaUrl(bucket, key);
    n++
  ) {
    key = `${draft.id}-${n}`
  }
  return { key, url: schemaUrl(bucket, key) }
}

export function applyFlow(
  config: RawConfig | undefined,
  draft: FlowDraft,
  schema: { key: string; url: string } | null,
): RawConfig {
  const base: RawConfig = config ?? {
    version: '1',
    is_workflow_required: false,
    workflows: {},
  }
  const prev = base.workflows?.[draft.id] ?? {}
  const { description, handle_pattern, is_message_required, metadata_schema, ...rest } =
    prev
  const workflow: RawConfig = {
    ...rest,
    name: draft.name.trim(),
    ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
    ...(draft.namePattern ? { handle_pattern: draft.namePattern } : {}),
    ...(draft.messageRequired ? { is_message_required: true } : {}),
  }
  if (draft.fields === null) {
    if (metadata_schema) workflow.metadata_schema = metadata_schema
  } else if (draft.fields.length && schema) {
    workflow.metadata_schema = schema.key
  }
  const next: RawConfig = {
    ...base,
    workflows: { ...base.workflows, [draft.id]: workflow },
  }
  if (workflow.metadata_schema === schema?.key && schema) {
    next.schemas = { ...base.schemas, [schema.key]: { url: schema.url } }
  }
  return next
}

// `null`: no flows left. quilt3 rejects a config with no workflows, so the file goes.
export function removeFlow(config: RawConfig, id: string): RawConfig | null {
  const { [id]: _removed, ...workflows } = config.workflows ?? {}
  if (!Object.keys(workflows).length) return null
  const next: RawConfig = { ...config, workflows }
  if (next.default_workflow === id) delete next.default_workflow
  return next
}

export function promoteFromConfig(config: RawConfig | undefined): Promote[] {
  return Object.entries(config?.successors ?? {}).map(([url, s]: [string, any]) => ({
    bucket: s3paths.parseS3Url(url).bucket || url,
    title: s?.title ?? '',
    copyData: s?.copy_data !== false,
  }))
}

export function applyPromote(config: RawConfig, promote: Promote[]): RawConfig {
  const { successors: _old, ...rest } = config
  const rows = promote.filter((p) => p.bucket.trim())
  if (!rows.length) return rest
  return {
    ...rest,
    successors: Object.fromEntries(
      rows.map((p) => [
        `s3://${p.bucket.trim()}`,
        {
          title: p.title.trim() || p.bucket.trim(),
          ...(p.copyData ? {} : { copy_data: false }),
        },
      ]),
    ),
  }
}
