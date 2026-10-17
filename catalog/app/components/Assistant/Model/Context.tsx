import * as Eff from 'effect'
import * as R from 'ramda'
import * as React from 'react'

import DistributedContext from 'utils/DistributedContext'
import { runtime } from 'utils/Effect'
import useConst from 'utils/useConstant'
import useMemoEq from 'utils/useMemoEq'
import useSettledGate from 'utils/useSettledGate'

import type * as PromptContract from './PromptContract'
import * as Tool from './Tool'
import useIsEnabled from './enabled'

export interface ContextShape {
  messages: string[]
  tools: Tool.Collection
  markers: Record<string, boolean>
  /** Qurator's prompt contract, once the registry has served it. */
  prompt?: PromptContract.PromptContract
}

const ContextAggregator = DistributedContext<Partial<ContextShape>>()

export const ContextAggregatorProvider = ContextAggregator.Provider

const ROOT_CONTEXT: ContextShape = {
  tools: {},
  messages: [],
  markers: {},
}

const aggregateContext = (contexts: Partial<ContextShape>[]) =>
  contexts.reduce(
    (acc: ContextShape, next) => ({
      // XXX: check for conflicts?
      tools: { ...acc.tools, ...next.tools },
      messages: acc.messages.concat(next.messages || []),
      markers: { ...acc.markers, ...next.markers },
      prompt: next.prompt ?? acc.prompt,
    }),
    ROOT_CONTEXT,
  )

export const merge = (...contexts: Partial<ContextShape>[]) => aggregateContext(contexts)

/** Set by Ask mode: the model is offered read tools only. */
export const ASK_MODE = 'askMode'

/**
 * Applied both where the prompt is built and where a returned tool call is
 * looked up, so a write the model names anyway resolves to no tool and fails.
 */
export const forMode = (ctx: ContextShape): ContextShape =>
  ctx.markers[ASK_MODE]
    ? {
        ...ctx,
        tools: Object.fromEntries(
          Object.entries(ctx.tools).filter(([, t]) => t.effect === 'read'),
        ),
      }
    : ctx

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

/**
 * The conversation's view of the aggregated context. With `wait`, a read
 * waits until a contribution sets `wait.marker`, for up to `wait.timeoutMs`,
 * so a turn does not start before a contribution it needs has loaded.
 */
export function useLayer(wait?: { marker: string; timeoutMs: number }) {
  const contextObj = useAggregatedContext()
  const ref = React.useRef(contextObj)
  if (ref.current !== contextObj) ref.current = contextObj
  const gate = useSettledGate(!wait || !!contextObj.markers[wait.marker])
  const timeoutMs = wait?.timeoutMs
  const context = React.useMemo(() => {
    const read = Eff.Effect.sync(() => ref.current)
    if (timeoutMs === undefined) return read
    return Eff.Effect.timeoutOption(gate, Eff.Duration.millis(timeoutMs)).pipe(
      Eff.Effect.andThen(read),
    )
  }, [gate, ref, timeoutMs])
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
