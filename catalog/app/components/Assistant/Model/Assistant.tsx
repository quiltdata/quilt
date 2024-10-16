import * as Eff from 'effect'
import invariant from 'invariant'

import * as React from 'react'

import * as AWS from 'utils/AWS'
import * as Actor from 'utils/Actor'

import * as Bedrock from './Bedrock'
import * as Context from './Context'
import * as Conversation from './Conversation'
import * as GlobalContext from './GlobalContext'
import useIsEnabled from './enabled'

export const DISABLED = Symbol('DISABLED')

function usePassThru<T>(val: T) {
  const ref = React.useRef(val)
  ref.current = val
  return ref
}

function useConstructAssistantAPI() {
  const passThru = usePassThru({
    bedrock: AWS.Bedrock.useClient(),
    context: Context.useLayer(),
  })
  const layerEff = Eff.Effect.sync(() =>
    Eff.Layer.merge(
      Bedrock.LLMBedrock(passThru.current.bedrock),
      passThru.current.context,
    ),
  )
  const [state, dispatch] = Actor.useActorLayer(
    Conversation.ConversationActor,
    Conversation.init,
    layerEff,
  )

  GlobalContext.use()

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

export type AssistantAPI = ReturnType<typeof useConstructAssistantAPI>
export type { AssistantAPI as API }

const Ctx = React.createContext<AssistantAPI | typeof DISABLED | null>(null)

function AssistantAPIProvider({ children }: React.PropsWithChildren<{}>) {
  return <Ctx.Provider value={useConstructAssistantAPI()}>{children}</Ctx.Provider>
}

function DisabledAPIProvider({ children }: React.PropsWithChildren<{}>) {
  return <Ctx.Provider value={DISABLED}>{children}</Ctx.Provider>
}

export function AssistantProvider({ children }: React.PropsWithChildren<{}>) {
  return useIsEnabled() ? (
    <Context.ContextAggregatorProvider>
      <AssistantAPIProvider>{children}</AssistantAPIProvider>
    </Context.ContextAggregatorProvider>
  ) : (
    <DisabledAPIProvider>{children}</DisabledAPIProvider>
  )
}

export function useAssistantAPI() {
  const api = React.useContext(Ctx)
  invariant(api, 'AssistantAPI must be used within an AssistantProvider')
  return api === DISABLED ? null : api
}

export function useAssistant() {
  return useAssistantAPI()?.assist
}
