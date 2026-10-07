import * as Eff from 'effect'
import * as React from 'react'
import * as urql from 'urql'

import { useLightLLMs } from 'components/Assistant/Model/Assistant'
import * as Content from 'components/Assistant/Model/Content'
import * as LLM from 'components/Assistant/Model/LLM'
import WORKFLOW_PACKAGES from 'containers/Bucket/Workflows/gql/WorkflowPackages.generated'
import { runtime } from 'utils/Effect'
import { type JsonSchema, makeSchemaValidator } from 'utils/JSONSchema'
import Log from 'utils/Logging'
import type * as Types from 'utils/types'

import { pointer } from './metaGuide'

export type Suggestions = Record<string, { value: Types.Json; reason?: string }>

export interface Example {
  name: string
  meta: Types.JsonRecord
}

export interface SuggestInput {
  examples: Example[]
  files: string[]
  name?: string
  schema: JsonSchema
  value?: Types.JsonRecord
}

const MAX_FILES = 200
const MAX_EXAMPLE_CHARS = 2000

/** JSON safe to place between prompt tags: `<` cannot open or close one. */
const tagSafe = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c')

/**
 * Only the schema's own fields of another package, size-capped: its metadata
 * is untrusted text from other users and the prompt has a budget.
 */
export function toExample(
  name: string,
  meta: Types.JsonRecord,
  schema: JsonSchema,
): Example {
  const picked = Object.keys(schema.properties || {}).flatMap((k) =>
    Object.hasOwn(meta, k) && JSON.stringify(meta[k]).length <= MAX_EXAMPLE_CHARS
      ? [[k, meta[k]] as const]
      : [],
  )
  return { name, meta: Object.fromEntries(picked) }
}

const SYSTEM = [
  'You suggest metadata values for a data package in Quilt.',
  'Base every suggestion on the evidence given: metadata of similar packages, the package name and its file names.',
  'Skip a field rather than guess when the evidence does not support a value.',
  'Answer with a single JSON object and nothing else:',
  '{"<field>": {"value": <value matching the field schema>, "reason": "<12 words max>"}}',
].join('\n')

export function buildPrompt({
  examples,
  files,
  name,
  schema,
  value,
}: SuggestInput): string {
  const fields = Object.entries(schema.properties || {}).map(
    ([key, p]: [string, any]) => ({
      key,
      required: Array.isArray(schema.required) && schema.required.includes(key),
      ...Object.fromEntries(
        [
          'title',
          'description',
          'type',
          'enum',
          'format',
          'minimum',
          'maximum',
          'pattern',
        ]
          .filter((k) => p?.[k] !== undefined)
          .map((k) => [k, p[k]]),
      ),
    }),
  )
  return [
    `<fields>\n${tagSafe(fields)}\n</fields>`,
    `<current-metadata>\n${tagSafe(value || {})}\n</current-metadata>`,
    `<package-name>${tagSafe(name || '(not set)')}</package-name>`,
    `<files count="${files.length}">\n${files.slice(0, MAX_FILES).map(tagSafe).join('\n')}\n</files>`,
    `<similar-packages>\n${examples.map(tagSafe).join('\n')}\n</similar-packages>`,
    'Suggest values for the fields. Leave out fields you cannot support with the evidence.',
  ].join('\n\n')
}

/**
 * The model's answer, keeping only values that pass their field's schema: a
 * suggestion the workflow would reject is worse than none.
 */
export function parseSuggestions(
  text: string,
  schema: JsonSchema,
  value: Types.JsonRecord = {},
): Suggestions {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return {}
  let raw: unknown
  try {
    raw = JSON.parse(match[0])
  } catch {
    return {}
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const properties: Record<string, JsonSchema> = schema.properties || {}
  const validate = makeSchemaValidator(schema)
  // Root-level errors the metadata already has are not the suggestion's fault.
  const sig = (e: Error | { keyword?: string; schemaPath?: string; message?: string }) =>
    'schemaPath' in e ? `${e.schemaPath}|${e.message}` : e.message
  const before = new Set(
    validate(value)
      .filter((e) => !('instancePath' in e) || !e.instancePath)
      .map(sig),
  )
  const out: Suggestions = {}
  for (const [key, entry] of Object.entries(raw as Record<string, any>)) {
    if (!Object.hasOwn(properties, key)) continue
    if (!entry || typeof entry !== 'object' || !('value' in entry)) continue
    const v = entry.value
    if (v === null || v === undefined || v === '') continue
    // the whole schema, so $refs and cross-field rules apply; only this key's errors count
    const ptr = pointer(key)
    const errors = validate({ ...value, [key]: v }).filter((e) => {
      if (!('instancePath' in e)) return true
      if (e.instancePath === ptr || e.instancePath.startsWith(`${ptr}/`)) return true
      return !e.instancePath && e.keyword !== 'required' && !before.has(sig(e))
    })
    if (errors.length) continue
    out[key] = {
      value: v,
      reason: typeof entry.reason === 'string' ? entry.reason.slice(0, 120) : undefined,
    }
  }
  return out
}

const ask = (prompt: string) =>
  LLM.LLM.pipe(
    Eff.Effect.andThen((llm) =>
      llm.converse(
        { system: SYSTEM, messages: [LLM.userMessage(Content.text(prompt))] },
        { inferenceConfig: { maxTokens: 800 } },
      ),
    ),
    Eff.Effect.map(({ content }) =>
      Eff.pipe(
        content,
        Eff.Option.getOrElse((): Content.ResponseMessageContentBlock[] => []),
        Eff.Array.filterMap((b) =>
          b._tag === 'Text' ? Eff.Option.some(b.text) : Eff.Option.none(),
        ),
      ).join('\n'),
    ),
  )

export type SuggestState =
  | { _tag: 'unavailable' }
  | { _tag: 'idle' }
  | { _tag: 'loading' }
  | { _tag: 'ready'; suggestions: Suggestions; examples: number; ms: number }
  | { _tag: 'error'; message: string }

interface UseSuggestParams {
  bucket: string
  workflow?: string
  name?: string
  files: string[]
  schema?: JsonSchema
  value?: Types.JsonRecord
}

/**
 * On request, asks the lightest approved model for values, using the latest
 * packages of the same workflow as evidence. Those come from the registry's
 * package search under the user's session, so only packages the user can
 * read are ever shown to the model.
 */
export function useMetaSuggestions({
  bucket,
  workflow,
  name,
  files,
  schema,
  value,
}: UseSuggestParams) {
  const llms = useLightLLMs(!!schema?.properties)
  const client = urql.useClient()
  const [state, setState] = React.useState<SuggestState>({ _tag: 'idle' })
  const available = !!llms?.length && !!schema?.properties

  // Suggestions were checked against one bucket/workflow/schema; a reply for
  // an older request or context must not land on the current form.
  const generation = React.useRef(0)
  React.useEffect(() => {
    generation.current += 1
    setState({ _tag: 'idle' })
  }, [bucket, workflow, schema])
  React.useEffect(
    () => () => {
      generation.current += 1
    },
    [],
  )

  const request = React.useCallback(async () => {
    if (!llms?.length || !schema) return
    const mine = ++generation.current
    setState({ _tag: 'loading' })
    const t0 = Date.now()
    try {
      // Without a workflow there is no way to tell which packages are similar.
      const r = workflow
        ? await client
            .query(WORKFLOW_PACKAGES, {
              buckets: [bucket],
              filter: { workflow: { terms: [workflow] } } as any,
            })
            .toPromise()
        : null
      const set = r?.data?.searchPackages
      const hits =
        set?.__typename === 'PackagesSearchResultSet' &&
        set.firstPage.__typename === 'PackagesSearchResultSetPage'
          ? set.firstPage.hits
          : []
      const examples: Example[] = hits.flatMap((h) => {
        try {
          const meta = h.meta ? JSON.parse(h.meta) : null
          return meta && typeof meta === 'object' && !Array.isArray(meta)
            ? [toExample(h.name, meta, schema)]
            : []
        } catch {
          return []
        }
      })
      const prompt = buildPrompt({ examples, files, name, schema, value })
      let text: string | null = null
      let lastError: unknown
      for (const llm of llms) {
        try {
          text = await runtime.runPromise(ask(prompt).pipe(Eff.Effect.provide(llm)))
          break
        } catch (e) {
          lastError = e
          // only a model this stack cannot reach is worth trying the next one for
          if (
            !/AccessDenied|not (authorized|available|found)|ResourceNotFound|ValidationException.*model|\b404\b/i.test(
              String(e),
            )
          )
            break
        }
      }
      if (generation.current !== mine) return
      if (text === null) throw lastError
      setState({
        _tag: 'ready',
        suggestions: parseSuggestions(text, schema, value),
        examples: examples.length,
        ms: Date.now() - t0,
      })
    } catch (e) {
      if (generation.current !== mine) return
      Log.error('Metadata suggestions failed:', e)
      setState({ _tag: 'error', message: 'The model did not answer.' })
    }
  }, [bucket, client, files, llms, name, schema, value, workflow])

  return { state: available ? state : ({ _tag: 'unavailable' } as const), request }
}
