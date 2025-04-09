import {
  messageToBedrockMessage,
  createMessage,
  BedrockMessage,
  Message,
} from './Message'

const SYSTEM_PROMPT = `You are a conservative and creative scientist. When asked a question about Quilt, refer to the documentation at https://docs.quilt.bio. For cross-account bucket policies, see https://docs.quilt.bio/advanced/crossaccount. Use GitHub flavored Markdown syntax for formatting when appropriate.`

export interface History {
  messages: Message[]
}

// Creates new `History` object augmented with system prompt
export function historyCreate(prompt: Message): History {
  return { messages: [createMessage(SYSTEM_PROMPT, 'system'), prompt] }
}

// Push message to the end of messages list in existing history
export function historyAppend(prompt: Message, history: History): History {
  return { messages: history.messages.concat(prompt) }
}

// Fold messages with the same role into a single message
// Bedrock doesn't accept multiple messages with the same role, they should alternate user -> assistant -> user -> ...
// But for convinience we have multiple 'system'/'user' messages in a row ('system' becomes 'user')
export function foldMessages(messages: Message[]): BedrockMessage[] {
  return messages.reduce((memo, message) => {
    const bedrockMessage = messageToBedrockMessage(message)
    const last = memo[memo.length - 1]
    if (last && last.role === bedrockMessage.role) {
      return [
        ...memo.slice(0, -1),
        { role: last.role, content: `${last.content}\n${bedrockMessage.content}` },
      ]
    }
    return memo.concat(bedrockMessage)
  }, [] as BedrockMessage[])
}
