// Utilities for discovering Bedrock models that support TEXT in/out and testing access.
// Can be run as a script (ts-node) OR imported for UI usage (model selector dialog).
import {
  BedrockClient,
  ListFoundationModelsCommand,
  ModelModality,
  FoundationModelSummary,
} from '@aws-sdk/client-bedrock'
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime'

export type ModelCheckResult = {
  modelId: string
  name: string
  provider: string
  status: 'ENABLED' | 'NO_ACCESS' | 'SKIPPED_NON_TEXT' | 'OTHER' | 'TRANSIENT'
  detail: string
}

async function listModels(region: string): Promise<FoundationModelSummary[]> {
  const client = new BedrockClient({ region })
  const resp = await client.send(new ListFoundationModelsCommand({}))
  return resp.modelSummaries ?? []
}

async function tryConverse(runtime: BedrockRuntimeClient, modelId: string): Promise<void> {
  await runtime.send(
    new ConverseCommand({
      modelId,
      messages: [{ role: 'user', content: [{ text: 'hi' }] }],
      inferenceConfig: { maxTokens: 1 },
    }),
  )
}

function classifyError(err: Error | unknown): { status: ModelCheckResult['status']; detail: string } {
  const code = err?.name || err?.Code || 'Unknown'
  if (typeof code === 'string' && code.includes('AccessDenied')) return { status: 'NO_ACCESS', detail: code }
  if (
    [
      'ValidationException',
      'ModelErrorException',
      'BadRequestException',
      'UnsupportedOperationException',
    ].includes(code)
  ) {
    return { status: 'OTHER', detail: code }
  }
  if (
    ['ThrottlingException', 'TooManyRequestsException', 'ServiceUnavailableException'].includes(
      code,
    )
  ) {
    return { status: 'TRANSIENT', detail: code }
  }
  return { status: 'OTHER', detail: code }
}

export async function discoverTextModels(region: string): Promise<ModelCheckResult[]> {
  const models = await listModels(region)
  const runtime = new BedrockRuntimeClient({ region })
  const results: ModelCheckResult[] = []
  for (const m of models) {
    const modelId = m.modelId ?? ''
    const name = m.modelName ?? '?'
    const provider = m.providerName ?? '?'
    const inputs = new Set(m.inputModalities as ModelModality[])
    const outputs = new Set(m.outputModalities as ModelModality[])
    if (inputs.has('TEXT') && outputs.has('TEXT')) {
      try {
        await tryConverse(runtime, modelId)
        results.push({ modelId, name, provider, status: 'ENABLED', detail: 'OK' })
      } catch (e) {
        const { status, detail } = classifyError(e)
        results.push({ modelId, name, provider, status, detail })
      }
    } else {
      results.push({
        modelId,
        name,
        provider,
        status: 'SKIPPED_NON_TEXT',
        detail: `input=${Array.from(inputs).join(',')}, output=${Array.from(outputs).join(',')}`,
      })
    }
  }
  return results
}

// CLI support when executed directly (node dist/ListModels.js <region>)
if (require.main === module) {
  ;(async () => {
    const region = process.argv[2]
    if (!region) {
      // eslint-disable-next-line no-console
      console.error('Usage: node ListModels.js <region>')
      process.exit(1)
    }
    try {
      const results = await discoverTextModels(region)
      // eslint-disable-next-line no-console
      console.table(results)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error:', err)
      process.exit(1)
    }
  })()
}
