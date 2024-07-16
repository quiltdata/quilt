import * as Eff from 'effect'
import invariant from 'invariant'

import * as React from 'react'

import * as AWS from 'utils/AWS'
import * as Actor from 'utils/Actor'

import * as Bedrock from './Bedrock'
import * as Context from './Context'
import * as Conversation from './Conversation'
import * as GlobalTools from './GlobalTools'

function usePassThru<T>(val: T): T {
  const ref = React.useRef(val)
  ref.current = val
  return ref.current
}

function useConstructAssistantAPI() {
  const passThru = usePassThru({
    bedrock: AWS.Bedrock.useClient(),
    context: Context.useLayer(),
  })
  const layerEff = Eff.Effect.sync(() =>
    Eff.Layer.merge(Bedrock.LLMBedrock(passThru.bedrock), passThru.context),
  )
  const [state, dispatch] = Actor.useActorLayer(
    Conversation.ConversationActor,
    Eff.Effect.succeed(Conversation.init),
    layerEff,
  )

  Context.usePushContext({
    tools: GlobalTools.use(),
  })

  // XXX: move this to actor state?
  const [visible, setVisible] = React.useState(false)
  const show = React.useCallback(() => setVisible(true), [])
  const hide = React.useCallback(() => setVisible(false), [])

  const assist = React.useCallback(
    (msg?: string) => {
      if (msg) dispatch(Conversation.Action.Ask({ content: msg }))
      show()
    },
    [show, dispatch],
  )

  return {
    visible,
    show,
    hide,
    assist,
    state,
    dispatch,
  }
}

type AssistantAPI = ReturnType<typeof useConstructAssistantAPI>

const Ctx = React.createContext<AssistantAPI | null>(null)

function AssistantAPIProvider({ children }: React.PropsWithChildren<{}>) {
  return <Ctx.Provider value={useConstructAssistantAPI()}>{children}</Ctx.Provider>
}

export function AssistantProvider({ children }: React.PropsWithChildren<{}>) {
  return (
    <Context.ContextAggregatorProvider>
      <AssistantAPIProvider>{children}</AssistantAPIProvider>
    </Context.ContextAggregatorProvider>
  )
}

export function useAssistantAPI() {
  const api = React.useContext(Ctx)
  invariant(api, 'AssistantAPI must be used within an AssistantProvider')
  return api
}

export function useAssistant() {
  return useAssistantAPI().assist
}
