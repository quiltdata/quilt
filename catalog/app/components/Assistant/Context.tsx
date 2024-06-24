import invariant from 'invariant'
import * as R from 'ramda'
import * as React from 'react'
import * as uuid from 'uuid'
import { JSONSchema, Schema } from '@effect/schema'

import useMemoEq from 'utils/useMemoEq'

export interface ToolDescriptor<I, O> {
  description?: string
  schema: {}
  fn: (params: I) => O
}

export type ToolMap = Record<string, ToolDescriptor<any, any>>

export function makeTool<I, O>(
  schema: Schema.Schema<I>,
  fn: (params: I) => O,
): ToolDescriptor<I, O> {
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

interface ContextShape {
  messages: string[]
  tools: ToolMap
}

interface ContextAggregator {
  push: (context: ContextShape) => () => void
  counter: number
  getValues: () => ContextShape[]
}

export const ContextAggregatorCtx = React.createContext<ContextAggregator | null>(null)

export function ContextAggregatorProvider({ children }: React.PropsWithChildren<{}>) {
  const mountedRef = React.useRef<Record<string, ContextShape>>({})
  const [counter, setCounter] = React.useState(0)

  const push = React.useCallback(
    (context: ContextShape) => {
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

function aggregateContext(contexts: ContextShape[]) {
  // eslint-disable-next-line no-console
  console.log('aggregate', contexts)
  return contexts.reduce(
    (acc, next) => ({
      // XXX: check for conflicts?
      tools: { ...acc.tools, ...next.tools },
      messages: acc.messages.concat(next.messages),
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

export function usePushContext(context: ContextShape) {
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
