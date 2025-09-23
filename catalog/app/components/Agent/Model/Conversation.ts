import * as Eff from 'effect'
import * as uuid from 'uuid'

import * as Actor from 'utils/Actor'
import * as Log from 'utils/Logging'

import * as Content from './Content'
import * as LLM from './LLM'
import * as Tool from './Tool'

const MODULE = 'Conversation'

// TODO: make this a globally available service?
const genId = Eff.Effect.sync(uuid.v4)

// TODO: use effect/DateTime after upgrading
const getNow = Eff.Clock.currentTimeMillis.pipe(Eff.Effect.map((t) => new Date(t)))

export interface ToolCall {
  readonly name: string
  readonly input: Record<string, any>
  readonly fiber: Eff.Fiber.RuntimeFiber<void>
}

export type ToolUseId = string

export type ToolCalls = Record<ToolUseId, ToolCall>

interface EventBase {
  readonly id: string
  readonly timestamp: Date
  readonly discarded?: boolean
}

export type Event = Eff.Data.TaggedEnum<{
  Message: EventBase & {
    readonly role: 'user' | 'assistant'
    readonly content: Content.MessageContentBlock
  }
  ToolUse: EventBase & {
    readonly toolUseId: string
    readonly name: string
    readonly input: Record<string, any>
    readonly result: Tool.Result
  }
}>

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const Event = Eff.Data.taggedEnum<Event>()

export interface ConversationError {
  readonly message: string
  readonly details?: string
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const ConversationError = Eff.Data.case<ConversationError>()

interface IdleWithError {
  readonly events: readonly Event[]
  readonly timestamp: Date
  readonly error: Eff.Option.Option<ConversationError>
}

export type State = Eff.Data.TaggedEnum<{
  Idle: IdleWithError
  WaitingForAssistant: {
    // TODO: add AbortController
    readonly events: readonly Event[]
    readonly timestamp: Date
    readonly requestFiber: Eff.Fiber.RuntimeFiber<void>
  }
  ToolUse: {
    readonly events: readonly Event[]
    readonly timestamp: Date
    readonly calls: ToolCalls
  }
}>

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const State = Eff.Data.taggedEnum<State>()

// Extract the ToolUse type from ResponseMessageContentBlock
type ToolUse = Extract<Content.ResponseMessageContentBlock, { _tag: 'ToolUse' }>

export type Action = Eff.Data.TaggedEnum<{
  Ask: { readonly content: string }
  Abort: {}
  Clear: {}
  Discard: { readonly id: string }
  LLMError: { readonly error: LLM.LLMError }
  LLMResponse: {
    readonly content: Content.ResponseMessageContentBlock[]
    readonly toolUses: ToolUse[]
  }
  ToolResult: { readonly id: string; readonly result: Tool.ResultOption }
}>

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const Action = Eff.Data.taggedEnum<Action>()

export const init = Eff.Effect.gen(function* () {
  return State.Idle({
    timestamp: yield* getNow,
    events: [],
    error: Eff.Option.none(),
  })
})

const mkUserMsg = (content: string, id: string, timestamp: Date) =>
  Event.Message({
    id,
    timestamp,
    role: 'user',
    content: Content.MessageContentBlock.Text({ text: content }),
  })

const mkAssistantMsg = (
  content: Content.ResponseMessageContentBlock[],
  id: string,
  timestamp: Date,
) => {
  // TODO: remove non-text from content, if any
  const textContent = Eff.Array.filterMap(
    content,
    Eff.flow(
      Content.ResponseMessageContentBlock.$match({
        Text: ({ text }) => Eff.Option.some(text),
        ToolUse: () => Eff.Option.none(),
        Image: () => Eff.Option.none(),
        Document: () => Eff.Option.none(),
      }),
    ),
  ).join('\n\n')

  return Event.Message({
    id,
    timestamp,
    role: 'assistant',
    content: Content.MessageContentBlock.Text({ text: textContent }),
  })
}

const getLLMResponse = (
  events: readonly Event[],
): Eff.Effect.Effect<
  { content: Content.ResponseMessageContentBlock[]; toolUses: ToolUse[] },
  LLM.LLMError,
  LLM.LLM
> =>
  Eff.Effect.gen(function* () {
    const llm = yield* LLM.LLM
    const filteredEvents = events.filter((e) => !e.discarded)
    const prompt = yield* constructPrompt(filteredEvents)

    const response = yield* llm.converse(prompt)

    if (Eff.Option.isNone(response.content)) {
      return yield* Eff.Effect.fail(
        new LLM.LLMError({ message: 'No content in LLM response' }),
      )
    }

    const [toolUses, content] = Eff.Array.partitionMap(response.content.value, (c) =>
      c._tag === 'ToolUse' ? Eff.Either.left(c as ToolUse) : Eff.Either.right(c),
    )

    return { content, toolUses }
  })

// XXX: separate "service" from handlers
export const ConversationActor = Eff.Effect.succeed(
  Log.scopedFn(`${MODULE}.ConversationActor`)(
    Actor.taggedHandler<State, Action, LLM.LLM>({
      Idle: {
        Ask: (state, action, dispatch) =>
          Eff.Effect.gen(function* () {
            const timestamp = yield* getNow
            const id = yield* genId
            const userMsg = mkUserMsg(action.content, id, timestamp)
            const events = state.events.concat(userMsg)

            const requestFiber = yield* Eff.Effect.fork(
              getLLMResponse(events).pipe(
                Eff.Effect.matchEffect({
                  onSuccess: (r) =>
                    dispatch(Action.LLMResponse(r)).pipe(Eff.Effect.asVoid),
                  onFailure: (error) =>
                    dispatch(Action.LLMError({ error })).pipe(Eff.Effect.asVoid),
                }),
              ),
            )
            return State.WaitingForAssistant({ events, timestamp, requestFiber })
          }),
        Abort: (state) => Eff.Effect.succeed(state),
        Clear: () =>
          Eff.Effect.succeed(
            State.Idle({ events: [], timestamp: new Date(), error: Eff.Option.none() }),
          ),
        Discard: (state, { id }) =>
          Eff.Effect.sync(() => {
            const events = state.events.map((e) =>
              e.id === id ? { ...e, discarded: true } : e,
            )
            return State.Idle({ ...state, events })
          }),
        LLMError: (state) => Eff.Effect.succeed(state),
        LLMResponse: (state) => Eff.Effect.succeed(state),
        ToolResult: (state) => Eff.Effect.succeed(state),
      },
      WaitingForAssistant: {
        Ask: (state) => Eff.Effect.succeed(state),
        Abort: (state) =>
          Eff.Effect.gen(function* () {
            yield* Eff.Fiber.interrupt(state.requestFiber)
            return State.Idle({
              events: state.events,
              timestamp: new Date(),
              error: Eff.Option.none(),
            })
          }),
        Clear: (state) => Eff.Effect.succeed(state),
        Discard: (state) => Eff.Effect.succeed(state),
        LLMError: (state, { error }) =>
          Eff.Effect.sync(() =>
            State.Idle({
              events: state.events,
              timestamp: new Date(),
              error: Eff.Option.some(
                ConversationError({
                  message: `Error while calling LLM`,
                  details: error.message,
                }),
              ),
            }),
          ),
        LLMResponse: (state, { content, toolUses }, dispatch) =>
          Eff.Effect.gen(function* () {
            const timestamp = yield* getNow
            const id = yield* genId
            const assistantMsg = mkAssistantMsg(content, id, timestamp)
            const events = state.events.concat(assistantMsg)

            if (!toolUses.length) {
              return State.Idle({ events, timestamp, error: Eff.Option.none() })
            }

            // For now, we don't have tools in the Agent
            // MCP tools will be added later
            const calls: Record<string, ToolCall> = {}
            for (const tu of toolUses) {
              // Mock tool execution for now
              const fiber = yield* Eff.Effect.fork(
                Eff.Effect.gen(function* () {
                  // Simulate tool not found
                  const result = Eff.Option.some(
                    Tool.Result({
                      status: 'error',
                      content: [
                        Content.ToolResultContentBlock.Text({
                          text: `Tool "${tu.name}" not found. MCP integration coming soon!`,
                        }),
                      ],
                    }),
                  )
                  yield* dispatch(Action.ToolResult({ id: tu.toolUseId, result }))
                }),
              )
              calls[tu.toolUseId] = {
                name: tu.name,
                input: tu.input,
                fiber,
              }
            }
            return State.ToolUse({ events, timestamp, calls })
          }),
        ToolResult: (state) => Eff.Effect.succeed(state),
      },
      ToolUse: {
        Ask: (state) => Eff.Effect.succeed(state),
        Abort: (state) =>
          Eff.Effect.gen(function* () {
            // Convert the calls object to an array of values for forEach
            const callsArray = Object.values(state.calls)
            yield* Eff.Effect.forEach(callsArray, ({ fiber }) =>
              Eff.Fiber.interrupt(fiber),
            )
            return State.Idle({
              events: state.events,
              timestamp: new Date(),
              error: Eff.Option.none(),
            })
          }),
        Clear: (state) => Eff.Effect.succeed(state),
        Discard: (state) => Eff.Effect.succeed(state),
        LLMError: (state) => Eff.Effect.succeed(state),
        LLMResponse: (state) => Eff.Effect.succeed(state),
        ToolResult: (state, { id, result }, dispatch) =>
          Eff.Effect.gen(function* () {
            const timestamp = yield* getNow
            const call = state.calls[id]
            if (!call) return state

            const resultOrEmpty = Eff.Option.getOrElse(result, () =>
              Tool.Result({
                status: 'error',
                content: [
                  Content.ToolResultContentBlock.Text({
                    text: 'Tool execution interrupted',
                  }),
                ],
              }),
            )

            const eventId = yield* genId
            const event = Event.ToolUse({
              id: eventId,
              timestamp,
              toolUseId: id,
              name: call.name,
              input: call.input,
              result: resultOrEmpty,
            })
            const events = state.events.concat(event)

            const remainingCalls = Eff.Record.remove(state.calls, id)
            if (Eff.Record.size(remainingCalls) === 0) {
              const requestFiber = yield* Eff.Effect.fork(
                getLLMResponse(events).pipe(
                  Eff.Effect.matchEffect({
                    onSuccess: (r) =>
                      dispatch(Action.LLMResponse(r)).pipe(Eff.Effect.asVoid),
                    onFailure: (error) =>
                      dispatch(Action.LLMError({ error })).pipe(Eff.Effect.asVoid),
                  }),
                ),
              )

              return State.WaitingForAssistant({
                events,
                timestamp,
                requestFiber,
              })
            }

            return State.ToolUse({ events, timestamp, calls: remainingCalls })
          }),
      },
    }),
  ),
)

const SYSTEM_PROMPT = `You are Quilt Agent, an AI assistant in the Quilt web catalog.
You help users with data management and analysis tasks.

Use GitHub Flavored Markdown syntax for formatting when appropriate.
`

export const constructPrompt = (events: Event[]): Eff.Effect.Effect<LLM.Prompt> =>
  Eff.Effect.gen(function* () {
    const [msgEvents, toolEvents] = Eff.Array.partitionMap(
      events,
      Event.$match({
        Message: (m) => Eff.Either.left(m),
        ToolUse: (t) => Eff.Either.right(t),
      }),
    )

    const toolMessages = Eff.Array.flatMap(
      toolEvents,
      ({ toolUseId, name, input, result }) => [
        LLM.assistantMessage(
          Content.PromptMessageContentBlock.ToolUse({ toolUseId, name, input }),
        ),
        LLM.userMessage(
          Content.PromptMessageContentBlock.ToolResult({
            toolUseId,
            status: result.status,
            content: result.content,
          }),
        ),
      ],
    )

    const conversationMessages = Eff.Array.filterMap(msgEvents, ({ role, content }) => {
      // Only handle Text messages for now
      if (content._tag !== 'Text') return Eff.Option.none()

      const msg =
        role === 'user'
          ? LLM.userMessage(
              Content.PromptMessageContentBlock.Text({ text: content.text }),
            )
          : LLM.assistantMessage(
              Content.PromptMessageContentBlock.Text({ text: content.text }),
            )
      return Eff.Option.some(msg)
    })

    const allMessages = [...conversationMessages, ...toolMessages]

    const messages: Eff.Array.NonEmptyArray<LLM.PromptMessage> =
      allMessages.length === 0
        ? [LLM.userMessage(Content.PromptMessageContentBlock.Text({ text: 'Hello' }))]
        : (allMessages as Eff.Array.NonEmptyArray<LLM.PromptMessage>)

    return {
      system: SYSTEM_PROMPT,
      messages,
    }
  })
