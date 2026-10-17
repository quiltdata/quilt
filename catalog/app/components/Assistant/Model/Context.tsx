import * as Eff from 'effect'
import * as R from 'ramda'
import * as React from 'react'

import DistributedContext from 'utils/DistributedContext'
import defer from 'utils/defer'
import { runtime } from 'utils/Effect'
import useConst from 'utils/useConstant'
import useMemoEq from 'utils/useMemoEq'

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

/**
 * Set once the first read of the prompt contract settles. A turn waits for it,
 * up to PROMPT_WAIT_MS, instead of failing while the contract is still loading.
 * Contributions register after the first render, so readiness has to be a
 * positive signal: the absence of a "loading" marker would read as ready.
 */
export const PROMPT_SETTLED = 'promptSettled'

const PROMPT_WAIT_MS = 15_000

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

export function useLayer() {
  const contextObj = useAggregatedContext()
  const ref = React.useRef(contextObj)
  if (ref.current !== contextObj) ref.current = contextObj
  const ready = useConst(() => defer<void>())
  const settled = !!contextObj.markers[PROMPT_SETTLED]
  React.useEffect(() => {
    if (settled) ready.resolver.resolve()
  }, [settled, ready])
  const context = React.useMemo(
    () =>
      Eff.Effect.promise(() => ready.promise).pipe(
        Eff.Effect.timeoutTo({
          duration: Eff.Duration.millis(PROMPT_WAIT_MS),
          onSuccess: () => undefined,
          onTimeout: () => undefined,
        }),
        Eff.Effect.map(() => ref.current),
      ),
    [ready, ref],
  )
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
