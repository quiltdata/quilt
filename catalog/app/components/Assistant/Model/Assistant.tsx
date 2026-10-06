import * as Eff from 'effect'
import invariant from 'invariant'

import * as React from 'react'
import * as redux from 'react-redux'

import * as Actor from 'utils/Actor'
import { runtime } from 'utils/Effect'
import * as GQL from 'utils/GraphQL'
import useConst from 'utils/useConstant'
import cfg from 'constants/config'
import * as authActions from 'containers/Auth/actions'
import defer from 'utils/defer'

import * as Relay from './Relay'
import * as Connectors from './Connectors'
import * as Mcp from './Connectors/Mcp'
import MCP_SERVERS_QUERY from './gql/McpServers.generated'
import * as Context from './Context'
import * as ContextFiles from './ContextFiles'
import * as Conversation from './Conversation'
import * as GlobalContext from './GlobalContext'
import * as ModelChoice from './ModelChoice'
import * as UserInstructions from './UserInstructions'
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
const INFERENCE_URL_KEY = 'QUILT_INFERENCE_URL'

/**
 * A `localStorage` service-URL override, honoured in dev builds only.
 *
 * Both endpoints below are sent the catalog session bearer, so an override
 * picks where that token goes — in a shipped bundle that makes any foothold in
 * the tab a credential exfiltration channel.
 */
function devUrlOverride(key: string): string | null {
  if (process.env.NODE_ENV !== 'development') return null
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(key)
}

/**
 * MCP endpoint for the platform connector. Defaults to the registry-
 * hostnamed `/mcp/platform/mcp` rewrite; `localStorage.QUILT_MCP_URL`
 * overrides for local dev (mirrors `QUILT_BEDROCK_MODEL_ID`).
 */
function getPlatformMcpUrl(): string {
  return devUrlOverride(MCP_URL_KEY) || `${cfg.registryUrl}/mcp/platform/mcp`
}

/**
 * The registry's inference relay. The model call is issued from there rather
 * than from the browser, so a deployment's gateway credential never reaches
 * the client. `localStorage.QUILT_INFERENCE_URL` overrides for local dev, as
 * `QUILT_MCP_URL` does.
 */
function getInferenceUrl(): string {
  return devUrlOverride(INFERENCE_URL_KEY) || `${cfg.registryUrl}/api/inference`
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
  const getToken = useSessionToken()
  return React.useMemo(
    () => ({
      id: 'platform',
      title: 'Quilt Platform tools',
      hint: PLATFORM_CONNECTOR_HINT,
      autoload: PLATFORM_AUTOLOAD,
      backend: Mcp.bearerPassthru({
        url: getPlatformMcpUrl(),
        getToken,
      }),
    }),
    [getToken],
  )
}

type RegisteredServers = GQL.DataForDoc<typeof MCP_SERVERS_QUERY>['mcpServers']

const NO_SERVERS: RegisteredServers = []

/**
 * Suspends on first read: the connector set is allocated once per mount, so a
 * later list would never reach the assistant. A failed read degrades to
 * platform tools only; a registry without this field is a real state mid-update.
 */
export function useRegisteredConnectorConfigs(): readonly Connectors.ConnectorConfig[] {
  const getToken = useSessionToken()
  let servers: RegisteredServers = NO_SERVERS
  try {
    servers = GQL.useQueryS(MCP_SERVERS_QUERY).mcpServers
  } catch (e) {
    // A suspension is a thrown promise, not a failure.
    // `useQueryS` has already logged and reported a failure.
    if (typeof (e as { then?: unknown } | null)?.then === 'function') throw e
  }
  return React.useMemo(
    () =>
      servers.map((s) => ({
        id: s.slug,
        title: s.title,
        hint: s.hint ?? undefined,
        optional: true,
        thirdParty: !s.trusted,
        backend: Mcp.relayed({ slug: s.slug, getToken }),
      })),
    [servers, getToken],
  )
}

/**
 * The catalog session token, resolved through the auth saga so an expired
 * session is refreshed rather than handed over stale. Reading the store
 * directly would 401 forever after an idle tab, where the Bedrock path used to
 * self-heal through the credential refresh. `null` when there is no session.
 */
function useSessionToken(): () => Eff.Effect.Effect<string | null> {
  const dispatch = redux.useDispatch()
  return React.useCallback(
    () =>
      Eff.Effect.tryPromise({
        try: () => {
          const { resolver, promise } = defer<{ token?: string } | undefined>()
          dispatch(authActions.getTokens(resolver))
          return promise
        },
        catch: () => null,
      }).pipe(
        Eff.Effect.map((tokens) => tokens?.token ?? null),
        Eff.Effect.catchAll(() => Eff.Effect.succeed(null)),
      ),
    [dispatch],
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
 * fires and the lifecycle fibers leak. Mitigation: in
 * `useConstructAssistantAPI`, the suspending hooks
 * (`useDualInstructionsContext` via `CatalogSettings.use()`, and
 * `useRegisteredConnectorConfigs` via the registry query) run before this
 * one, so a cold-load suspend throws before `useConst` allocates; keep
 * that order. Proper fix is to defer allocation into `useEffect` and
 * expose a Loading state on AssistantAPI.
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

export function useModelIdOverride() {
  const { governed, settled, failed } = ModelChoice.useGoverned()
  const [value, setValue] = React.useState(
    () =>
      (typeof localStorage !== 'undefined' && localStorage.getItem(MODEL_ID_KEY)) || '',
  )

  // Dropped, not just ignored: a stored value would otherwise come back into
  // force the moment the governed read is slow or fails.
  const stale = ModelChoice.isStale(governed, value)
  React.useEffect(() => {
    if (stale) setValue('')
  }, [stale])

  React.useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      if (value) {
        localStorage.setItem(MODEL_ID_KEY, value)
      } else {
        localStorage.removeItem(MODEL_ID_KEY)
      }
    }
  }, [value])

  const current = ModelChoice.resolve(governed, value, DEFAULT_MODEL_ID, failed)
  const currentPassThru = usePassThru(current)
  // A turn waits for the governed read: sent before it settles, a stored model
  // the admin has since disallowed would reach the relay and be refused.
  const ready = useConst(() => defer<void>())
  React.useEffect(() => {
    if (settled) ready.resolver.resolve()
  }, [settled, ready])
  const modelIdEff = React.useMemo(
    () =>
      Eff.Effect.promise(() => ready.promise).pipe(
        Eff.Effect.map(() => currentPassThru.current),
      ),
    [ready, currentPassThru],
  )

  return [
    modelIdEff,
    React.useMemo(() => ({ value, setValue }), [value, setValue]),
    React.useMemo(
      () => ({
        allowlist: governed?.allowlist ?? null,
        names: governed?.names ?? {},
        readFailed: failed,
        current,
        select: setValue,
      }),
      [governed, failed, current, setValue],
    ),
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

/**
 * Feed both instruction layers into the prompt through the same aggregation
 * path as every other context contribution, so they show up in the
 * `<context>` block (and in DevTools) instead of being hidden system strings.
 * Each layer is independent: either, both or neither can be active, and each
 * carries its own tag so the model can tell the stack's steer from the user's
 * own notes. Global goes first — the deployment's frame, then the user's.
 * The `userInstructions`/`personalInstructions` markers let other surfaces
 * observe which layers are in effect.
 */
function useDualInstructionsContext(): UserInstructions.DualInstructions {
  const global = UserInstructions.useGlobalInstructions()
  const personal = UserInstructions.usePersonalInstructions()

  Context.usePushContext(
    React.useMemo(() => {
      const messages = []
      if (global.active) messages.push(UserInstructions.toPromptBlock(global.text))
      if (personal.active)
        messages.push(UserInstructions.toPersonalPromptBlock(personal.text))
      return messages.length
        ? {
            messages,
            markers: {
              userInstructions: global.active,
              personalInstructions: personal.active,
            },
          }
        : {}
    }, [global.active, global.text, personal.active, personal.text]),
  )

  return React.useMemo(() => ({ global, personal }), [global, personal])
}

function useConstructAssistantAPI() {
  const [modelId, modelIdOverride, model] = useModelIdOverride()
  const [record, recording] = useRecording()
  const instructions = useDualInstructionsContext()

  const platformConfig = usePlatformConnectorConfig()
  // Before `useConnectors`: this suspends on first render, and a render
  // unwound after `useConnectors` allocates would orphan its fibers.
  const registeredConfigs = useRegisteredConnectorConfigs()
  const connectorConfigs = React.useMemo(
    () => [platformConfig, ...registeredConfigs],
    [platformConfig, registeredConfigs],
  )
  const connectors = useConnectors(connectorConfigs)

  const getToken = useSessionToken()
  const passThru = usePassThru({
    context: Context.useLayer(),
    connectors,
  })

  const [busy, setBusy] = React.useState(false)
  const onBusy = React.useCallback((b: boolean) => Eff.Effect.sync(() => setBusy(b)), [])

  const llm = React.useMemo(
    () => Relay.LLMRelay({ url: getInferenceUrl(), modelId, record, getToken, onBusy }),
    [modelId, record, getToken, onBusy],
  )

  const layerEff = Eff.Effect.sync(() =>
    Eff.Layer.mergeAll(
      llm,
      passThru.current.context,
      Eff.Layer.succeed(Connectors.Connectors, passThru.current.connectors),
    ),
  )

  const [state, dispatch] = Actor.useActorLayer(
    Conversation.ConversationActor,
    Conversation.init,
    layerEff,
  )

  GlobalContext.use(llm)

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
    busy,
    connectors,
    instructions,
    model,
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
