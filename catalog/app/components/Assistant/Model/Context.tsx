import * as Eff from 'effect'
import * as R from 'ramda'
import * as React from 'react'

import DistributedContext from 'utils/DistributedContext'
import { runtime } from 'utils/Effect'
import useConst from 'utils/useConstant'
import useMemoEq from 'utils/useMemoEq'

import * as Tool from './Tool'
import useIsEnabled from './enabled'

export interface ContextShape {
  messages: string[]
  tools: Tool.Collection
  markers: Record<string, boolean>
  toolGuidance: string[]
}

const ContextAggregator = DistributedContext<Partial<ContextShape>>()

export const ContextAggregatorProvider = ContextAggregator.Provider

const ROOT_CONTEXT: ContextShape = {
  tools: {},
  messages: [],
  markers: {},
  toolGuidance: [],
}

const aggregateContext = (contexts: Partial<ContextShape>[]) =>
  contexts.reduce(
    (acc: ContextShape, next) => ({
      // XXX: check for conflicts?
      tools: { ...acc.tools, ...next.tools },
      messages: acc.messages.concat(next.messages || []),
      markers: { ...acc.markers, ...next.markers },
      toolGuidance: acc.toolGuidance.concat(next.toolGuidance || []),
    }),
    ROOT_CONTEXT,
  )

export const useAggregatedContext = ContextAggregator.makeCombinator(aggregateContext)

export const usePushContext = (context: Partial<ContextShape>) =>
  ContextAggregator.useProvide(useMemoEq(context, R.identity))

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
