import * as Eff from 'effect'
import * as React from 'react'
import { JSONSchema, Schema } from '@effect/schema'

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
  schema: JSONSchema.JsonSchema7Root
  executor: Executor<I>
}

export type Collection = Record<string, Descriptor<any>>

export function make<A, I>(schema: Schema.Schema<A, I>, fn: Executor<A>): Descriptor<A> {
  const jsonSchema = JSONSchema.make(schema)

  const decode = Schema.decodeUnknown(schema, {
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
  schema: Schema.Schema<A, I>,
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
