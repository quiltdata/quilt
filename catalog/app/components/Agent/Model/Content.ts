import * as Eff from 'effect'

import { JsonRecord } from 'utils/types'

// XXX: schema for en/decoding to/from aws bedrock types?

export const DOCUMENT_FORMATS = [
  'pdf',
  'csv',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'html',
  'txt',
  'md',
] as const
export type DocumentFormat = (typeof DOCUMENT_FORMATS)[number]

export interface DocumentBlock {
  format: DocumentFormat
  name: string
  // A base64-encoded string of a UTF-8 encoded file, that is the document to include in the message.
  source: Buffer | Uint8Array | Blob | string
}

export const IMAGE_FORMATS = ['png', 'jpeg', 'gif', 'webp'] as const
export type ImageFormat = (typeof IMAGE_FORMATS)[number]

export interface ImageBlock {
  format: ImageFormat
  // The raw image bytes for the image. If you use an AWS SDK, you don't need to base64 encode the image bytes.
  source: Buffer | Uint8Array | Blob | string
}

export interface JsonBlock {
  json: JsonRecord
}

export interface TextBlock {
  text: string
}

export interface GuardBlock {
  text: string
}

export interface ToolUseBlock {
  toolUseId: string
  name: string
  input: JsonRecord
}

export type ToolResultContentBlock = Eff.Data.TaggedEnum<{
  Json: JsonBlock
  Text: TextBlock
  Image: ImageBlock
  Document: DocumentBlock
}>

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const ToolResultContentBlock = Eff.Data.taggedEnum<ToolResultContentBlock>()

export type ToolResultStatus = 'success' | 'error'

export interface ToolResultBlock {
  toolUseId: string
  content: ToolResultContentBlock[]
  status: ToolResultStatus
}

export type ResponseMessageContentBlock = Eff.Data.TaggedEnum<{
  // GuardContent: {}
  // ToolResult: {}
  ToolUse: ToolUseBlock
  Text: TextBlock
  Image: ImageBlock
  Document: DocumentBlock
}>

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const ResponseMessageContentBlock =
  Eff.Data.taggedEnum<ResponseMessageContentBlock>()

export type MessageContentBlock = Eff.Data.TaggedEnum<{
  Text: TextBlock
  Image: ImageBlock
  Document: DocumentBlock
}>

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const MessageContentBlock = Eff.Data.taggedEnum<MessageContentBlock>()

export type PromptMessageContentBlock = Eff.Data.TaggedEnum<{
  GuardContent: GuardBlock
  ToolResult: ToolResultBlock
  ToolUse: ToolUseBlock
  Text: TextBlock
  Image: ImageBlock
  Document: DocumentBlock
}>

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const PromptMessageContentBlock = Eff.Data.taggedEnum<PromptMessageContentBlock>()

export const text = (first: string, ...rest: string[]) =>
  PromptMessageContentBlock.Text({ text: [first, ...rest].join('\n') })
