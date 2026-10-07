import * as Eff from 'effect'
import * as React from 'react'
import * as urql from 'urql'

import { useLightLLMs } from 'components/Assistant/Model/Assistant'
import * as Content from 'components/Assistant/Model/Content'
import * as LLM from 'components/Assistant/Model/LLM'
import WORKFLOW_PACKAGES from 'containers/Bucket/Workflows/gql/WorkflowPackages.generated'
import { runtime } from 'utils/Effect'
import { type JsonSchema, makeSchemaValidator } from 'utils/JSONSchema'
import type * as Types from 'utils/types'

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
    `<fields>\n${JSON.stringify(fields)}\n</fields>`,
    `<current-metadata>\n${JSON.stringify(value || {})}\n</current-metadata>`,
    `<package-name>${name || '(not set)'}</package-name>`,
    `<files count="${files.length}">\n${files.slice(0, MAX_FILES).join('\n')}\n</files>`,
    `<similar-packages>\n${examples.map((e) => JSON.stringify(e)).join('\n')}\n</similar-packages>`,
    'Suggest values for the fields. Leave out fields you cannot support with the evidence.',
  ].join('\n\n')
}

/**
 * The model's answer, keeping only values that pass their field's schema: a
 * suggestion the workflow would reject is worse than none.
 */
export function parseSuggestions(text: string, schema: JsonSchema): Suggestions {
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
  const out: Suggestions = {}
  for (const [key, entry] of Object.entries(raw as Record<string, any>)) {
    const prop = properties[key]
    if (!prop || !entry || typeof entry !== 'object' || !('value' in entry)) continue
    const v = entry.value
    if (v === null || v === undefined || v === '') continue
    const errors = makeSchemaValidator({
      type: 'object',
      properties: { [key]: prop },
    })({ [key]: v })
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
  const llms = useLightLLMs()
  const client = urql.useClient()
  const [state, setState] = React.useState<SuggestState>({ _tag: 'idle' })
  const available = !!llms?.length && !!schema?.properties

  const request = React.useCallback(async () => {
    if (!llms?.length || !schema) return
    setState({ _tag: 'loading' })
    const t0 = Date.now()
    try {
      const r = await client
        .query(WORKFLOW_PACKAGES, {
          buckets: [bucket],
          filter: (workflow ? { workflow: { terms: [workflow] } } : {}) as any,
        })
        .toPromise()
      const set = r.data?.searchPackages
      const hits =
        set?.__typename === 'PackagesSearchResultSet' &&
        set.firstPage.__typename === 'PackagesSearchResultSetPage'
          ? set.firstPage.hits
          : []
      const examples: Example[] = hits.flatMap((h) => {
        try {
          const meta = h.meta ? JSON.parse(h.meta) : null
          return meta && typeof meta === 'object' ? [{ name: h.name, meta }] : []
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
        }
      }
      if (text === null) throw lastError
      setState({
        _tag: 'ready',
        suggestions: parseSuggestions(text, schema),
        examples: examples.length,
        ms: Date.now() - t0,
      })
    } catch (e) {
      setState({
        _tag: 'error',
        message:
          e instanceof Error ? e.message : 'Suggestions are not available right now',
      })
    }
  }, [bucket, client, files, llms, name, schema, value, workflow])

  return { state: available ? state : ({ _tag: 'unavailable' } as const), request }
}
