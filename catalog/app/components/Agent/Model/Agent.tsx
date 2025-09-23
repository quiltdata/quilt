import * as Eff from 'effect'
import invariant from 'invariant'
import * as React from 'react'

import * as AWS from 'utils/AWS'
import * as Actor from 'utils/Actor'

import * as Bedrock from './Bedrock'
import * as Conversation from './Conversation'

function usePassThru<T>(val: T) {
  const ref = React.useRef(val)
  ref.current = val
  return ref
}

export const DEFAULT_MODEL_ID = 'us.anthropic.claude-3-7-sonnet-20250219-v1:0'
const MODEL_ID_KEY = 'AGENT_BEDROCK_MODEL_ID'

function useModelIdOverride() {
  const [value, setValue] = React.useState(
    () =>
      (typeof localStorage !== 'undefined' && localStorage.getItem(MODEL_ID_KEY)) || '',
  )

  React.useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      if (value) {
        localStorage.setItem(MODEL_ID_KEY, value)
      } else {
        localStorage.removeItem(MODEL_ID_KEY)
      }
    }
  }, [value])

  const modelIdPassThru = usePassThru(value)
  const modelIdEff = React.useMemo(
    () => Eff.Effect.sync(() => modelIdPassThru.current || DEFAULT_MODEL_ID),
    [modelIdPassThru],
  )

  return [
    modelIdEff,
    React.useMemo(() => ({ value, setValue }), [value, setValue]),
  ] as const
}

function useRecording() {
  const [enabled, enable] = React.useState(false)
  const [log, setLog] = React.useState<string[]>([])

  const clear = React.useCallback(() => setLog([]), [])

  const enabledPassThru = usePassThru(enabled)
  const record = React.useCallback(
    (entry: string) =>
      Eff.Effect.sync(() => {
        if (enabledPassThru.current) setLog((l) => l.concat(entry))
      }),
    [enabledPassThru],
  )

  return [
    record,
    React.useMemo(() => ({ enabled, log, enable, clear }), [enabled, log, enable, clear]),
  ] as const
}

function useConstructAgentAPI() {
  const [modelId, modelIdOverride] = useModelIdOverride()
  const [record, recording] = useRecording()

  const passThru = usePassThru({
    bedrock: AWS.Bedrock.useClient(),
  })

  const layerEff = Eff.Effect.sync(() =>
    Bedrock.LLMBedrock(passThru.current.bedrock, { modelId, record }),
  )

  const [state, dispatch] = Actor.useActorLayer(
    Conversation.ConversationActor,
    Conversation.init,
    layerEff,
  )

  return {
    state,
    dispatch,
    devTools: { recording, modelIdOverride },
  }
}

export type AgentAPI = ReturnType<typeof useConstructAgentAPI>
export type { AgentAPI as API }

const Ctx = React.createContext<AgentAPI | null>(null)

export function AgentProvider({ children }: React.PropsWithChildren<{}>) {
  return <Ctx.Provider value={useConstructAgentAPI()}>{children}</Ctx.Provider>
}

export function useAgentAPI() {
  const api = React.useContext(Ctx)
  invariant(api, 'AgentAPI must be used within an AgentProvider')
  return api
}
