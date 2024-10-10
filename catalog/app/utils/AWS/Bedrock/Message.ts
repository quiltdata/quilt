import type { Body } from 'aws-sdk/clients/bedrockruntime'

export const CONTENT_TYPE = 'application/json'

// Roles used in chat to show different styles and hide system messages
type Role = 'user' | 'assistant' | 'system' | 'summarize'

// Roles used in bedrock API for messaging
type BedrockRole = 'user' | 'assistant'

export interface Message {
  role: Role
  content: string
}

export interface BedrockMessage {
  role: BedrockRole
  content: string
}

export function createMessage(text: string, role?: Role): Message {
  return { role: role || 'user', content: text }
}

async function bedrockBodyToString(body: Body): Promise<string> {
  if (typeof body === 'string') {
    return body
  }
  if (body instanceof Blob) {
    return body.text()
  }
  return new TextDecoder().decode(body as Buffer | Uint8Array)
}

async function bedrockJsonToMessage(json: any): Promise<Message> {
  const content = json?.content
  if (!content) {
    throw new Error('Failed to parse Bedrock response. `content` is empty')
  }
  if (typeof content === 'string') {
    return createMessage(content, 'assistant')
  }
  if (!Array.isArray(content)) {
    throw new Error('Failed to parse Bedrock response. Unsupported `content` type')
  }

  const message: Message | null = content
    .map((item) => {
      if (typeof item === 'string') {
        // There is no documenation example with string item,
        // but neither could I find a clear indication that it can't be a string
        return createMessage(item, 'assistant')
      }
      if (item.type === 'text' && typeof item.text === 'string') {
        return createMessage(item.text, 'assistant')
      }
      return null
    })
    .reduce((memo, item) => {
      if (!item) return null
      return createMessage(
        memo ? `${memo.content} ${item.content}` : item.content,
        'assistant',
      )
    }, null)
  if (!message) {
    throw new Error('Failed to parse Bedrock response. `content` list is empty')
  }
  return message
}

export async function bedrockBodyToMessage(
  body: Body,
  contentType: string,
): Promise<Message> {
  const output = await bedrockBodyToString(body)
  if (contentType !== CONTENT_TYPE) {
    throw new Error(`Unsupported content type: ${contentType}`)
  }
  const json = JSON.parse(output)
  return bedrockJsonToMessage(json)
}

// All 'system' messages become 'user' messages
export function messageToBedrockMessage(message: Message): BedrockMessage {
  if (message.role === 'user' || message.role === 'assistant') {
    return message as BedrockMessage
  }
  return {
    ...message,
    role: 'user',
  }
}
