import BedrockRuntime from 'aws-sdk/clients/bedrockruntime'
import * as Eff from 'effect'

import { JsonRecord } from 'utils/types'

import * as Content from './Content'
import * as Tool from './Tool'

export type Role = 'user' | 'assistant'

// XXX: explicitly restrict specific content blocks for each role?
export interface PromptMessage {
  role: Role
  content: Content.PromptMessageContentBlock
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const PromptMessage = Eff.Data.case<PromptMessage>()

export const userMessage = (content: Content.PromptMessageContentBlock) =>
  PromptMessage({ role: 'user', content })

export const assistantMessage = (content: Content.PromptMessageContentBlock) =>
  PromptMessage({ role: 'assistant', content })

export type ToolChoice = Eff.Data.TaggedEnum<{
  Auto: {}
  Any: {}
  Specific: {
    readonly name: string
  }
}>

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const ToolChoice = Eff.Data.taggedEnum<ToolChoice>()

export interface ToolConfig {
  tools: Tool.Collection
  choice?: ToolChoice
}

export interface Prompt {
  system: string
  messages: Eff.Array.NonEmptyArray<PromptMessage>
  toolConfig?: ToolConfig
}

export interface Options {
  inferenceConfig?: BedrockRuntime.InferenceConfiguration
  guardrailConfig?: BedrockRuntime.GuardrailConfiguration
  additionalModelRequestFields?: JsonRecord
  additionalModelResponseFieldPaths?: BedrockRuntime.ConverseRequestAdditionalModelResponseFieldPathsList
}

interface ConverseResponse {
  content: Eff.Option.Option<Content.ResponseMessageContentBlock[]>
  backendResponse: BedrockRuntime.ConverseResponse
}

export class LLMError {
  message: string

  constructor({ message }: { message: string }) {
    this.message = message
  }
}

// a service
export class LLM extends Eff.Context.Tag('LLM')<
  LLM,
  {
    converse: (
      prompt: Prompt,
      opts?: Options,
    ) => Eff.Effect.Effect<ConverseResponse, LLMError>
  }
>() {}
