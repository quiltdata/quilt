import invariant from 'invariant'
import * as React from 'react'
import * as uuid from 'uuid'

export interface ToolDescriptor<I, O> {
  description?: string
  schema: {}
  fn: (params: I) => O
}

export type ToolMap = Record<string, ToolDescriptor<any, any>>

interface ContextShape {
  messages: string[]
  tools: ToolMap
}

interface ContextAggregator {
  push: (context: ContextShape) => () => void
  counter: number
  aggregate: () => ContextShape
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

  const aggregate = React.useCallback(
    () => aggregateContext(Object.values(mountedRef.current)),
    [mountedRef],
  )

  const value = { push, counter, aggregate }

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

  const { aggregate, counter } = ctx
  const [computed, setComputed] = React.useState(aggregate)

  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('COMPUTE aggregated')
    setComputed(aggregate())
  }, [setComputed, aggregate, counter])

  return computed
}

export function usePushContext(context: ContextShape) {
  const ctx = React.useContext(ContextAggregatorCtx)
  invariant(ctx, 'ContextAggregator must be used within a ContextAggregatorProvider')
  const { push } = ctx
  React.useEffect(() => push(context), [push, context])
}

export function Push(context: ContextShape) {
  usePushContext(context)
  return null
}
