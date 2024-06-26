import type { Types as BedrockTypes } from 'aws-sdk/clients/bedrockruntime'
import invariant from 'invariant'
import * as R from 'ramda'
import * as React from 'react'
import * as uuid from 'uuid'
import { JSONSchema, Schema } from '@effect/schema'

import useMemoEq from 'utils/useMemoEq'

export type ToolResult = Promise<BedrockTypes.ToolResultContentBlocks>
export type ToolFn<I> = (params: I) => ToolResult

export interface ToolDescriptor<I> {
  description?: string
  schema: {}
  fn: ToolFn<I>
}

export type ToolMap = Record<string, ToolDescriptor<any>>

export function makeTool<I>(schema: Schema.Schema<I>, fn: ToolFn<I>): ToolDescriptor<I> {
  const jsonSchema = JSONSchema.make(schema)
  const decode = Schema.decodeUnknownSync(schema, {
    errors: 'all',
    onExcessProperty: 'error',
  })
  const wrappedFn = (params: unknown) => {
    const paramsDecoded = decode(params)
    return fn(paramsDecoded)
  }
  return {
    description: jsonSchema.description,
    schema: jsonSchema,
    fn: wrappedFn,
  }
}

const EMPTY_DEPS: React.DependencyList = []

export function useMakeTool<I>(
  schema: Schema.Schema<I>,
  fn: ToolFn<I>,
  deps?: React.DependencyList,
): ToolDescriptor<I> {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fnMemo = React.useCallback(fn, deps ?? EMPTY_DEPS)
  return React.useMemo(() => makeTool(schema, fnMemo), [schema, fnMemo])
}

interface ContextShape {
  messages: string[]
  tools: ToolMap
}

interface ContextAggregator {
  push: (context: Partial<ContextShape>) => () => void
  counter: number
  getValues: () => Partial<ContextShape>[]
}

export const ContextAggregatorCtx = React.createContext<ContextAggregator | null>(null)

export function ContextAggregatorProvider({ children }: React.PropsWithChildren<{}>) {
  const mountedRef = React.useRef<Record<string, Partial<ContextShape>>>({})
  const [counter, setCounter] = React.useState(0)

  const push = React.useCallback(
    (context: Partial<ContextShape>) => {
      const id = uuid.v4()
      // eslint-disable-next-line no-console
      console.log('push context', id, context)
      mountedRef.current[id] = context
      setCounter((c) => c + 1)
      return () => {
        delete mountedRef.current[id]
      }
    },
    [mountedRef],
  )

  const getValues = React.useCallback(
    () => Object.values(mountedRef.current),
    [mountedRef],
  )

  const value = { push, counter, getValues }

  return (
    <ContextAggregatorCtx.Provider value={value}>
      {children}
    </ContextAggregatorCtx.Provider>
  )
}

const ROOT_CONTEXT: ContextShape = {
  tools: {},
  messages: [],
}

function aggregateContext(contexts: Partial<ContextShape>[]) {
  // eslint-disable-next-line no-console
  console.log('aggregate', contexts)
  return contexts.reduce(
    (acc: ContextShape, next) => ({
      // XXX: check for conflicts?
      tools: { ...acc.tools, ...next.tools },
      messages: acc.messages.concat(next.messages || []),
    }),
    ROOT_CONTEXT,
  )
}

export function useAggregatedContext(): ContextShape {
  const ctx = React.useContext(ContextAggregatorCtx)
  invariant(ctx, 'ContextAggregator must be used within a ContextAggregatorProvider')

  const { getValues, counter } = ctx
  const [computed, setComputed] = React.useState(() => aggregateContext(getValues()))

  React.useEffect(() => {
    const values = getValues()
    const aggregated = aggregateContext(values)
    // eslint-disable-next-line no-console
    console.log('COMPUTE aggregated', { counter, values, aggregated })
    setComputed(aggregated)
  }, [setComputed, getValues, counter])

  return computed
}

export function usePushContext(context: Partial<ContextShape>) {
  const ctx = React.useContext(ContextAggregatorCtx)
  invariant(ctx, 'ContextAggregator must be used within a ContextAggregatorProvider')
  const { push } = ctx
  const contextMemo = useMemoEq(context, R.identity)
  React.useEffect(() => push(contextMemo), [push, contextMemo])
}

export function Push(context: ContextShape) {
  usePushContext(context)
  return null
}
