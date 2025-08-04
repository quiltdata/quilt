import * as React from 'react'

import BedrockRuntime from 'aws-sdk/clients/bedrockruntime'

import cfg from 'constants/config'

import * as Config from '../Config'
import * as Credentials from '../Credentials'

import { foldMessages, historyAppend, History } from './History'
import { CONTENT_TYPE, bedrockBodyToMessage, createMessage } from './Message'

type ConfigOverrides = Partial<BedrockRuntime.Types.ClientConfiguration>

export function useClient(overrides?: ConfigOverrides) {
  Credentials.use().suspend()

  const awsConfig = Config.use()

  return React.useMemo(
    () =>
      new BedrockRuntime({
        ...awsConfig,
        region: cfg.region,
        ...overrides,
      }),
    [awsConfig, overrides],
  )
}

const MODEL_ID = 'anthropic.claude-3-sonnet-20240229-v1:0'
const ANTHROPIC_VERSION = 'bedrock-2023-05-31'

// https://docs.aws.amazon.com/bedrock/latest/userguide/key-definitions.html
// Token – A sequence of characters that a model can interpret or predict as a single unit of meaning.
// Not a word, but eiher word, or phrase, or punctuaction mark, or word suffix or prefix.
export const MAX_TOKENS = 100000

// Bedrock calls are not free
// https://aws.amazon.com/bedrock/pricing/
//
// You can use `MOCK_BEDROCK = true` to mock Bedrock API response
const MOCK_BEDROCK = false

export function useBedrock(overrides?: ConfigOverrides) {
  const client = useClient(overrides)

  // `invokeModel()` with prepared new history (last message should be `user` or `system` message)
  // Returns new history with appended `assistant` message
  return React.useCallback(
    async (history: History): Promise<History> => {
      const contentType = CONTENT_TYPE
      const options = {
        contentType,
        body: JSON.stringify({
          anthropic_version: ANTHROPIC_VERSION,
          max_tokens: MAX_TOKENS,
          messages: foldMessages(history.messages),
        }),
        modelId: MODEL_ID,
      }
      const response = await client.invokeModel(options).promise()
      const output = await bedrockBodyToMessage(response.body, contentType)
      return historyAppend(output, history)
    },
    [client],
  )
}

// Use it to mock Bedrock API response
// It helps to test UI and reduce costs
function useMock() {
  return React.useCallback(
    (history: History): Promise<History> =>
      new Promise((resolve) => {
        setTimeout(() => {
          resolve(historyAppend(createMessage('Hello, world!', 'assistant'), history))
        }, 3000)
      }),
    [],
  )
}

export const use = MOCK_BEDROCK ? useMock : useBedrock
