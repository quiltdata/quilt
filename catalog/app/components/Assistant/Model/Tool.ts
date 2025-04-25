import * as Eff from 'effect'
import * as React from 'react'

import * as Content from './Content'

export interface Result {
  readonly content: Content.ToolResultContentBlock[]
  readonly status: 'success' | 'error'
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const Result = Eff.Data.case<Result>()

export const succeed = (...content: Content.ToolResultContentBlock[]) =>
  Result({ status: 'success', content })

export const fail = (...content: Content.ToolResultContentBlock[]) =>
  Result({ status: 'error', content })

export type ResultOption = Eff.Option.Option<Result>

export type Executor<I> = (params: I) => Eff.Effect.Effect<ResultOption>

export interface Descriptor<I> {
  description?: string
  schema: Eff.JSONSchema.JsonSchema7Root
  executor: Executor<I>
}

export type Collection = Record<string, Descriptor<any>>

/**
 * Ensure a JSON schema is compatible with draft-2020-12 by:
 * 1. Replacing $id: 'schemas/{}' with $id: 'schemas/empty'
 * 2. Converting draft-04/07 items/additionalItems to draft-2020 prefixItems/items
 */
function convertSchema(schema: any) {
  if (!schema || typeof schema !== 'object') return

  // Process arrays
  if (Array.isArray(schema)) {
    schema.forEach(convertSchema)
    return
  }

  // Process object properties recursively
  Object.values(schema).forEach(convertSchema)

  // Replace empty schema IDs produced by Effect, which are not valid according to draft-2020
  if (schema.$id === '/schemas/{}') schema.$id = '/schemas/empty'

  // Handle items and additionalItems conversion for draft-2020
  if (Array.isArray(schema.items)) {
    schema.prefixItems = schema.items
    delete schema.items
    if (schema.additionalItems !== undefined) {
      schema.items = schema.additionalItems
      delete schema.additionalItems
    }
  }
}

export function makeJSONSchema(schema: Eff.Schema.Schema<any, any>) {
  const out = Eff.JSONSchema.make(schema)
  out.$schema = 'https://json-schema.org/draft/2020-12/schema'
  convertSchema(out)
  return out
}

export function make<A, I>(
  schema: Eff.Schema.Schema<A, I>,
  fn: Executor<A>,
): Descriptor<A> {
  const jsonSchema = makeJSONSchema(schema)

  const decode = Eff.Schema.decodeUnknown(schema, {
    errors: 'all',
    onExcessProperty: 'error',
  })

  const wrappedFn = (params: unknown) =>
    decode(params).pipe(
      Eff.Effect.andThen(fn),
      Eff.Effect.catchAll((error) =>
        Eff.Effect.succeed(
          Eff.Option.some(
            Result({
              status: 'error',
              content: [
                Content.ToolResultContentBlock.Text({
                  text: `Error while executing tool:\n${error.message}`,
                }),
              ],
            }),
          ),
        ),
      ),
    )

  return {
    description: jsonSchema.description,
    schema: jsonSchema,
    executor: wrappedFn,
  }
}

const EMPTY_DEPS: React.DependencyList = []

export function useMakeTool<A, I>(
  schema: Eff.Schema.Schema<A, I>,
  fn: Executor<A>,
  deps: React.DependencyList = EMPTY_DEPS,
): Descriptor<A> {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fnMemo = React.useCallback(fn, deps)
  return React.useMemo(() => make(schema, fnMemo), [schema, fnMemo])
}

export const execute = (tools: Collection, name: string, input: unknown) =>
  name in tools
    ? tools[name].executor(input)
    : Eff.Effect.succeed(
        Eff.Option.some(
          Result({
            status: 'error',
            content: [
              Content.ToolResultContentBlock.Text({
                text: `Tool "${name}" not found`,
              }),
            ],
          }),
        ),
      )
