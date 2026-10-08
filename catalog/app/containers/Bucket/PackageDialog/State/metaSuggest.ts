import type { ErrorObject } from 'ajv'
import * as Eff from 'effect'
import * as React from 'react'
import * as urql from 'urql'

import { useLightLLMs } from 'components/Assistant/Model/Assistant'
import * as Content from 'components/Assistant/Model/Content'
import * as LLM from 'components/Assistant/Model/LLM'
import WORKFLOW_PACKAGES from 'containers/Bucket/Workflows/gql/WorkflowPackages.generated'
import { runtime } from 'utils/Effect'
import type { JsonSchema } from 'utils/JSONSchema'
import Log from 'utils/Logging'
import type * as Types from 'utils/types'

import { mkSubmitValidator } from './schema'

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
    `<current-metadata>\n${tagSafe(toExample('', value || {}, schema).meta)}\n</current-metadata>`,
    `<package-name>${tagSafe(name || '(not set)')}</package-name>`,
    `<files count="${files.length}">\n${files.slice(0, MAX_FILES).map(tagSafe).join('\n')}\n</files>`,
    `<similar-packages>\n${examples.map(tagSafe).join('\n')}\n</similar-packages>`,
    'Suggest values for the fields. Leave out fields you cannot support with the evidence.',
  ].join('\n\n')
}

/** A number JSON keeps as typed: finite, and an integer only if within the safe range. */
export const isExactNumber = (n: number) =>
  Number.isFinite(n) && (!Number.isInteger(n) || Number.isSafeInteger(n))

export const allExact = (v: unknown): boolean =>
  typeof v === 'number'
    ? isExactNumber(v)
    : v !== null && typeof v === 'object'
      ? Object.values(v).every(allExact)
      : true

/** The first top-level `{...}` in `text` that parses as JSON, ignoring prose around it. */
export function firstJsonObject(text: string): unknown {
  let end = -1
  for (
    let start = text.indexOf('{');
    start !== -1;
    start = text.indexOf('{', Math.max(start, end) + 1)
  ) {
    let depth = 0
    let inString = false
    for (let i = start; i < text.length; i += 1) {
      const c = text[i]
      if (inString) {
        if (c === '\\') i += 1
        else if (c === '"') inString = false
      } else if (c === '"') inString = true
      else if (c === '{') depth += 1
      else if (c === '}') {
        depth -= 1
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(start, i + 1))
          } catch {
            // its inner objects are fields, not the answer: resume after it
            end = i
            break
          }
        }
      }
    }
    // unterminated (a truncated reply): anything after `start` is inside it
    if (depth > 0) return undefined
  }
  return undefined
}

const errorSig = (e: Error | ErrorObject) =>
  'schemaPath' in e
    ? `${e.instancePath}|${e.schemaPath}|${JSON.stringify(e.params)}`
    : e.message

/** Errors `candidate` has that `base` does not: what a change would add. */
type Validate = (x: Types.JsonRecord) => (Error | ErrorObject)[]

/** Errors a candidate adds over `base`; validates `base` once for many candidates. */
export function newErrorsFrom(validate: Validate, base: Types.JsonRecord) {
  const known = new Set(validate(base).map(errorSig))
  return (candidate: Types.JsonRecord) =>
    validate(candidate).filter((e) => !known.has(errorSig(e)))
}

/**
 * The model's answer, keeping only values that add no error to the current
 * metadata: a suggestion the workflow would reject is worse than none.
 */
export function parseSuggestions(
  text: string,
  schema: JsonSchema,
  value: Types.JsonRecord = {},
  validate: Validate = mkSubmitValidator(schema),
): Suggestions {
  const raw = firstJsonObject(text)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const properties: Record<string, JsonSchema> = schema.properties || {}
  const adds = newErrorsFrom(validate, value)
  const out: Suggestions = {}
  for (const [key, entry] of Object.entries(raw as Record<string, any>)) {
    if (!Object.hasOwn(properties, key)) continue
    if (!entry || typeof entry !== 'object' || !('value' in entry)) continue
    const v = entry.value
    if (v === null || v === undefined || v === '') continue
    // JSON.parse already rounded it: an ID past 2^53 would be suggested wrong
    if (!allExact(v)) continue
    // the whole schema, so $refs and cross-field rules (if/then, dependencies) apply
    if (adds({ ...value, [key]: v }).length) continue
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
        { inferenceConfig: { maxTokens: 1500 } },
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

class SuggestError extends Error {}

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
  const validate = React.useMemo(() => schema && mkSubmitValidator(schema), [schema])

  // Suggestions were checked against one bucket/workflow/schema; a reply for
  // an older request or context must not land on the current form.
  const generation = React.useRef(0)
  const inflight = React.useRef<AbortController | null>(null)
  const filesKey = files.join('\n')
  React.useEffect(() => {
    generation.current += 1
    inflight.current?.abort()
    // a request cut short by a change says so instead of vanishing
    setState((s) =>
      s._tag === 'loading'
        ? { _tag: 'error', message: 'The package changed while asking. Try again.' }
        : { _tag: 'idle' },
    )
  }, [bucket, workflow, schema, filesKey])
  React.useEffect(
    () => () => {
      generation.current += 1
      inflight.current?.abort()
    },
    [],
  )

  const request = React.useCallback(async () => {
    if (!llms?.length || !schema) return
    const mine = ++generation.current
    inflight.current?.abort()
    const abort = new AbortController()
    inflight.current = abort
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
      // EmptySearchResultSet is "no similar packages"; any other variant is a failure
      const page = set?.__typename === 'PackagesSearchResultSet' ? set.firstPage : null
      if (
        r &&
        (r.error ||
          (set &&
            set.__typename !== 'EmptySearchResultSet' &&
            page?.__typename !== 'PackagesSearchResultSetPage'))
      ) {
        throw new SuggestError("Couldn't read similar packages.")
      }
      const hits = page?.__typename === 'PackagesSearchResultSetPage' ? page.hits : []
      // a revision's own earlier versions are not independent examples
      const examples: Example[] = hits.flatMap((h) => {
        if (name && h.name === name) return []
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
        if (generation.current !== mine || abort.signal.aborted) return
        try {
          text = await runtime.runPromise(ask(prompt).pipe(Eff.Effect.provide(llm)), {
            signal: abort.signal,
          })
          break
        } catch (e) {
          lastError = e
        }
      }
      if (generation.current !== mine) return
      if (text === null) throw lastError
      // a cut-off or prose-only reply is not "no clear values"
      if (firstJsonObject(text) === undefined) {
        throw new SuggestError(
          'The model did not return readable suggestions. Try again.',
        )
      }
      setState({
        _tag: 'ready',
        suggestions: parseSuggestions(text, schema, value, validate ?? undefined),
        examples: examples.length,
        ms: Date.now() - t0,
      })
    } catch (e) {
      if (generation.current !== mine) return
      Log.error('Metadata suggestions failed:', e)
      setState({
        _tag: 'error',
        message: e instanceof SuggestError ? e.message : 'The model did not answer.',
      })
    }
  }, [bucket, client, files, llms, name, schema, validate, value, workflow])

  return { state: available ? state : ({ _tag: 'unavailable' } as const), request }
}
