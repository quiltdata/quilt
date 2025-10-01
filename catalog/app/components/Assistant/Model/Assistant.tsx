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
import modelsConfig from './models.json'

export const DISABLED = Symbol('DISABLED')

function usePassThru<T>(val: T) {
  const ref = React.useRef(val)
  ref.current = val
  return ref
}

export const MODELS = modelsConfig.models
export const DEFAULT_MODEL_ID =
  MODELS.length > 0 ? MODELS[0].id : 'us.amazon.nova-lite-v1:0'
const MODEL_ID_KEY = 'QUILT_BEDROCK_MODEL_ID'

// Validation function to check if a model ID is valid
export function validateModelId(modelId: string): { isValid: boolean; error?: string } {
  if (!modelId || modelId.trim() === '') {
    return { isValid: true } // Empty is valid (will use default)
  }

  // Check if it's in our predefined models list
  const isKnownModel = MODELS.some((model) => model.id === modelId)
  if (isKnownModel) {
    return { isValid: true }
  }

  // For custom model IDs, validate the format (AWS Bedrock model ID pattern)
  const bedrockModelPattern = /^[a-z0-9.-]+:[a-z0-9.-]+:[0-9]+$/
  if (!bedrockModelPattern.test(modelId)) {
    return {
      isValid: false,
      error:
        'Invalid model ID format. Expected format: provider.model-name-version:region:number (e.g., us.amazon.nova-lite-v1:0)',
    }
  }

  // If it matches the pattern but isn't in our known list, it needs to be tested
  return {
    isValid: true,
    error: `Custom model "${modelId}" will be tested for availability in your AWS Bedrock account.`,
  }
}

// Test if a model is actually available in AWS Bedrock
export async function testModelAvailability(
  modelId: string,
  bedrockClient: any,
): Promise<{ available: boolean; error?: string }> {
  if (!modelId || modelId.trim() === '') {
    return { available: true } // Empty uses default, which is always available
  }

  try {
    // Try to make a minimal converse call to test the model
    await bedrockClient
      .converse({
        modelId,
        messages: [{ role: 'user', content: [{ text: 'test' }] }],
        inferenceConfig: { maxTokens: 1 }, // Minimal request to reduce cost
      })
      .promise()

    return { available: true }
  } catch (error: any) {
    // Parse AWS error codes
    if (error.code === 'ValidationException') {
      if (error.message?.includes('model') || error.message?.includes('Model')) {
        return {
          available: false,
          error: `Model "${modelId}" not found or not available in your AWS Bedrock account.`,
        }
      }
    }
    if (error.code === 'AccessDeniedException') {
      return {
        available: false,
        error: `Access denied to model "${modelId}". Check your AWS permissions and model access in the AWS Console.`,
      }
    }
    if (error.code === 'ThrottlingException') {
      return {
        available: true,
        error: `Model "${modelId}" is available but currently throttled. Try again later.`,
      }
    }

    // For any other error, assume model might be available but there's a different issue
    return {
      available: true,
      error: `Unable to test model "${modelId}": ${error.message || error.code || 'Unknown error'}`,
    }
  }
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

  const passThru = usePassThru({
    bedrock: AWS.Bedrock.useClient(),
    context: Context.useLayer(),
  })

  const layerEff = Eff.Effect.sync(() =>
    Eff.Layer.merge(
      Bedrock.LLMBedrock(passThru.current.bedrock, { modelId, record }),
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
