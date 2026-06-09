import * as Eff from 'effect'
import invariant from 'invariant'

import * as React from 'react'
import * as redux from 'react-redux'

import * as AWS from 'utils/AWS'
import * as Actor from 'utils/Actor'
import { runtime } from 'utils/Effect'
import useConst from 'utils/useConstant'
import cfg from 'constants/config'
import * as authSelectors from 'containers/Auth/selectors'

import * as Bedrock from './Bedrock'
import * as Connectors from './Connectors'
import * as Mcp from './Connectors/Mcp'
import * as Context from './Context'
import * as ContextFiles from './ContextFiles'
import * as Conversation from './Conversation'
import * as GlobalContext from './GlobalContext'
import useIsEnabled from './enabled'

export const DISABLED = Symbol('DISABLED')

function usePassThru<T>(val: T) {
  const ref = React.useRef(val)
  ref.current = val
  return ref
}

export const DEFAULT_MODEL_ID =
  cfg.quratorDefaultModel || 'us.anthropic.claude-sonnet-4-5-20250929-v1:0'
const MODEL_ID_KEY = 'QUILT_BEDROCK_MODEL_ID'

const MCP_URL_KEY = 'QUILT_MCP_URL'

/**
 * MCP endpoint for the platform connector. Defaults to the registry-
 * hostnamed `/mcp/platform/mcp` rewrite; `localStorage.QUILT_MCP_URL`
 * overrides for local dev (mirrors `QUILT_BEDROCK_MODEL_ID`).
 */
function getPlatformMcpUrl(): string {
  if (typeof localStorage !== 'undefined') {
    const override = localStorage.getItem(MCP_URL_KEY)
    if (override) return override
  }
  return `${cfg.registryUrl}/mcp/platform/mcp`
}

const PLATFORM_CONNECTOR_HINT =
  'Quilt Platform tools: packages, search, S3 objects, Athena queries, tabulator tables. Reference resources are listed below — autoloaded entries carry their content inline; fetch the rest with get_resource.'

/**
 * Resources autoloaded into the prompt at bootstrap. Reference-grade
 * docs the model needs before tool calls and won't fetch on its own.
 * `quilt-platform://buckets` is excluded because the catalog already
 * injects bucket info via `<quilt-stack-info>`; `quilt-platform://me`
 * is excluded as rarely needed for tool calls.
 */
const PLATFORM_AUTOLOAD: ReadonlySet<string> = new Set([
  'quilt-platform://search_syntax',
  'quilt-platform://athena',
])

/**
 * Build the platform connector config. The backend's `getToken`
 * re-reads the redux session token on every invocation so token
 * rotation is handled without explicit plumbing. `Mcp.bearerPassthru`
 * maps a `null` token to an internal auth error.
 */
function usePlatformConnectorConfig(): Connectors.ConnectorConfig {
  const store = redux.useStore()
  return React.useMemo(
    () => ({
      id: 'platform',
      title: 'Quilt Platform tools',
      hint: PLATFORM_CONNECTOR_HINT,
      autoload: PLATFORM_AUTOLOAD,
      backend: Mcp.bearerPassthru({
        url: getPlatformMcpUrl(),
        getToken: () =>
          Eff.Effect.sync(() => authSelectors.token(store.getState()) ?? null),
      }),
    }),
    [store],
  )
}

/**
 * Allocate the `ConnectorsService` for this Assistant mount. The
 * service is built once via `runtime.runSync` against a manually
 * managed `Scope`; the per-connector lifecycle fibers live under that
 * scope and are interrupted on unmount.
 *
 * Known limitation: allocation happens during render via `useConst`.
 * If React aborts the render before commit (Suspense unwind, Error
 * Boundary, concurrent-mode discard), the cleanup `useEffect` never
 * fires and the lifecycle fibers leak. Mitigation: `<AssistantProvider>`
 * is mounted at app root above any Suspense boundaries. Proper fix is
 * to defer allocation into `useEffect` and expose a Loading state on
 * AssistantAPI.
 */
function useConnectors(
  configs: readonly Connectors.ConnectorConfig[],
): Connectors.ConnectorsService {
  const built = useConst(() => {
    const scope = runtime.runSync(Eff.Scope.make())
    const service = runtime.runSync(
      Connectors.buildService(configs).pipe(
        Eff.Effect.provideService(Eff.Scope.Scope, scope),
      ),
    )
    return { service, scope }
  })
  React.useEffect(
    () => () => {
      runtime.runFork(Eff.Scope.close(built.scope, Eff.Exit.void))
    },
    [built],
  )
  return built.service
}

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

function useConstructAssistantAPI() {
  const [modelId, modelIdOverride] = useModelIdOverride()
  const [record, recording] = useRecording()

  const platformConfig = usePlatformConnectorConfig()
  const connectorConfigs = React.useMemo(() => [platformConfig], [platformConfig])
  const connectors = useConnectors(connectorConfigs)

  const passThru = usePassThru({
    bedrock: AWS.Bedrock.useClient(),
    context: Context.useLayer(),
    connectors,
  })

  const layerEff = Eff.Effect.sync(() =>
    Eff.Layer.mergeAll(
      Bedrock.LLMBedrock(passThru.current.bedrock, { modelId, record }),
      passThru.current.context,
      Eff.Layer.succeed(Connectors.Connectors, passThru.current.connectors),
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
    connectors,
    devTools: { recording, modelIdOverride },
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
      <ContextFiles.LoaderProvider>
        <AssistantAPIProvider>{children}</AssistantAPIProvider>
      </ContextFiles.LoaderProvider>
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
