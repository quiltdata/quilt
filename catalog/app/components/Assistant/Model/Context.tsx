import * as Eff from 'effect'
import invariant from 'invariant'
import * as R from 'ramda'
import * as React from 'react'
import * as uuid from 'uuid'

import { runtime } from 'utils/Effect'
import useConst from 'utils/useConstant'
import useMemoEq from 'utils/useMemoEq'

import * as Tool from './Tool'
import useIsEnabled from './enabled'

export interface ContextShape {
  messages: string[]
  tools: Tool.Collection
  markers: Record<string, boolean>
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
  markers: {},
}

function aggregateContext(contexts: Partial<ContextShape>[]) {
  // eslint-disable-next-line no-console
  console.log('aggregate', contexts)
  return contexts.reduce(
    (acc: ContextShape, next) => ({
      // XXX: check for conflicts?
      tools: { ...acc.tools, ...next.tools },
      messages: acc.messages.concat(next.messages || []),
      markers: { ...acc.markers, ...next.markers },
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

export function Push(context: Partial<ContextShape>) {
  usePushContext(context)
  return null
}

export type ContextProviderHook<Props> = (props: Props) => Partial<ContextShape>

export function LazyContext<Props>(useContext: ContextProviderHook<Props>) {
  function ProvideContext(props: Props) {
    usePushContext(useContext(props))
    return null
  }
  return function WithLazyContext(props: Props & JSX.IntrinsicAttributes) {
    return useIsEnabled() ? <ProvideContext {...props} /> : null
  }
}

export class ConversationContext extends Eff.Context.Tag('ConversationContext')<
  ConversationContext,
  {
    context: Eff.Effect.Effect<ContextShape>
  }
>() {}

export function useLayer() {
  const contextObj = useAggregatedContext()
  const ref = React.useRef(contextObj)
  if (ref.current !== contextObj) ref.current = contextObj
  const context = React.useMemo(() => Eff.Effect.sync(() => ref.current), [ref])
  return Eff.Layer.succeed(ConversationContext, { context })
}

export function useMarkersRef() {
  const { markers } = useAggregatedContext()
  const ref = useConst(() => runtime.runSync(Eff.SubscriptionRef.make(markers)))
  React.useEffect(() => {
    runtime.runFork(Eff.SubscriptionRef.set(ref, markers))
  }, [markers, ref])
  return ref
}
