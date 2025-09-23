import * as Eff from 'effect'
import invariant from 'invariant'
import * as React from 'react'

import * as AWS from 'utils/AWS'
import * as Actor from 'utils/Actor'

import * as Bedrock from './Bedrock'
import * as Conversation from './Conversation'
import * as MCPClient from './MCPClient'
import * as MCPToolAdapter from './MCPToolAdapter'

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
  const [mcpClient, setMcpClient] = React.useState<MCPClient.MCPClient | null>(null)
  const [mcpTools, setMcpTools] = React.useState({})
  const [mcpError, setMcpError] = React.useState<string | null>(null)

  const passThru = usePassThru({
    bedrock: AWS.Bedrock.useClient(),
  })

  // Connect to MCP server
  const connectMCP = React.useCallback(() => {
    Eff.Effect.gen(function* () {
      setMcpError(null)

      const mcpService = yield* MCPClient.MCPClientService
      const client = yield* mcpService.connect(MCPClient.getServerUrl('fetch'))
      setMcpClient(client)

      // Load tools from the MCP server
      const tools = yield* MCPToolAdapter.loadToolsFromMCPServer(client)
      setMcpTools(tools)
    })
      .pipe(
        Eff.Effect.provide(MCPClient.MCPClientServiceLive),
        Eff.Effect.catchAll((error) =>
          Eff.Effect.sync(() => {
            const errorMsg = `MCP connection failed: ${error}`
            setMcpError(errorMsg)
          }),
        ),
        Eff.Effect.runPromise,
      )
      .catch((e: unknown) => {
        setMcpError(`MCP connection error: ${e}`)
      })
  }, [])

  // Auto-connect on mount
  React.useEffect(() => {
    connectMCP()
  }, [connectMCP])

  const layerEff = Eff.Effect.sync(() =>
    Eff.Layer.merge(
      Bedrock.LLMBedrock(passThru.current.bedrock, { modelId, record }),
      Eff.Layer.succeed(Conversation.ToolService, mcpTools),
    ),
  )

  const [state, dispatch] = Actor.useActorLayer(
    Conversation.ConversationActor,
    Conversation.init,
    layerEff,
  )

  return {
    state,
    dispatch,
    mcpClient,
    mcpTools,
    mcpError,
    connectMCP,
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
