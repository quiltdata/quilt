import * as Eff from 'effect'
import * as uuid from 'uuid'

import * as Actor from 'utils/Actor'
import * as Log from 'utils/Logging'
import * as XML from 'utils/XML'

import * as Content from './Content'
import * as Context from './Context'
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

interface ConversationError {
  message: string
  details: string
}

interface StateBase {
  readonly events: Event[]
  readonly timestamp: Date
}

export type State = Eff.Data.TaggedEnum<{
  /**
   * Waiting for user input
   */
  Idle: StateBase & {
    readonly error: Eff.Option.Option<ConversationError>
  }

  /**
   * Waiting for assistant (LLM) to respond
   */
  WaitingForAssistant: StateBase & {
    readonly requestFiber: Eff.Fiber.RuntimeFiber<boolean>
  }

  /**
   * Tool use in progress
   */
  ToolUse: StateBase & {
    // TODO: use HashMap?
    readonly calls: Record<string, ToolCall>
    // readonly retries: number
  }
}>

const idle = (events: Event[], error?: ConversationError) =>
  Eff.Effect.map(getNow, (timestamp) =>
    State.Idle({ events, timestamp, error: Eff.Option.fromNullable(error) }),
  )

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const State = Eff.Data.taggedEnum<State>()

export type Action = Eff.Data.TaggedEnum<{
  Ask: {
    readonly content: string
  }
  LLMError: {
    readonly error: LLM.LLMError
  }
  LLMResponse: {
    readonly content: Exclude<Content.ResponseMessageContentBlock, { _tag: 'ToolUse' }>[]
    readonly toolUses: Extract<Content.ResponseMessageContentBlock, { _tag: 'ToolUse' }>[]
  }
  ToolUse: {
    readonly toolUseId: string
    readonly name: string
    readonly input: Record<string, any>
  }
  ToolResult: {
    readonly id: string
    readonly result: Tool.ResultOption
  }
  Abort: {}
  Clear: {}
  Discard: { readonly id: string }
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

const llmRequest = (events: Event[]) =>
  Log.scoped({
    name: `${MODULE}.llmRequest`,
    enter: [Log.br, 'events:', events],
  })(
    Eff.Effect.gen(function* () {
      const llm = yield* LLM.LLM
      const ctxService = yield* Context.ConversationContext
      const ctx = yield* ctxService.context
      const filteredEvents = events.filter((e) => !e.discarded)
      const prompt = yield* constructPrompt(filteredEvents, ctx)

      const response = yield* llm.converse(prompt)

      if (Eff.Option.isNone(response.content)) {
        return yield* Eff.Effect.fail(
          new LLM.LLMError({ message: 'No content in LLM response' }),
        )
      }

      const [toolUses, content] = Eff.Array.partitionMap(response.content.value, (c) =>
        c._tag === 'ToolUse' ? Eff.Either.left(c) : Eff.Either.right(c),
      )

      return { content, toolUses }
    }),
  )

// XXX: separate "service" from handlers
export const ConversationActor = Eff.Effect.succeed(
  Log.scopedFn(`${MODULE}.ConversationActor`)(
    Actor.taggedHandler<State, Action, LLM.LLM | Context.ConversationContext>({
      Idle: {
        Ask: (state, action, dispatch) =>
          Eff.Effect.gen(function* () {
            const timestamp = yield* getNow
            const event = Event.Message({
              id: yield* genId,
              timestamp,
              role: 'user',
              content: Content.text(action.content),
            })
            const events = state.events.concat(event)

            const requestFiber = yield* Actor.forkRequest(
              llmRequest(events),
              dispatch,
              (r) => Eff.Effect.succeed(Action.LLMResponse(r)),
              (error) => Eff.Effect.succeed(Action.LLMError({ error })),
            )
            return State.WaitingForAssistant({ events, timestamp, requestFiber })
          }),
        Clear: () => idle([]),
        Discard: (state, { id }) =>
          Eff.Effect.succeed({
            ...state,
            events: state.events.map((e) =>
              e.id === id ? { ...e, discarded: true } : e,
            ),
          }),
      },
      WaitingForAssistant: {
        LLMError: ({ events }, { error }) =>
          idle(events, {
            message: 'Error while interacting with LLM.',
            details: error.message,
          }),
        LLMResponse: (state, { content, toolUses }, dispatch) =>
          Eff.Effect.gen(function* () {
            const timestamp = yield* getNow

            let { events } = state
            if (content.length) {
              events = events.concat(
                yield* Eff.Effect.all(
                  content.map((c) =>
                    Eff.Effect.andThen(genId, (id) =>
                      Event.Message({
                        id,
                        timestamp,
                        role: 'assistant',
                        content: c,
                      }),
                    ),
                  ),
                ),
              )
            }

            if (!toolUses.length) {
              return State.Idle({ events, timestamp, error: Eff.Option.none() })
            }

            const ctxService = yield* Context.ConversationContext
            const { tools, toolGuidance } = yield* ctxService.context
            if (toolGuidance?.length) {
              // eslint-disable-next-line no-console
              console.info('[MCP] Tool guidance available', toolGuidance)
            }
            const calls: Record<string, ToolCall> = {}
            if (toolGuidance?.length && toolUses.length === 0) {
              // eslint-disable-next-line no-console
              console.info(
                '[MCP] No tool uses returned; guidance available',
                toolGuidance,
              )
            }

            for (const tu of toolUses) {
              const fiber = yield* Eff.Effect.fork(
                Eff.Effect.gen(function* () {
                  const result = yield* Tool.execute(tools, tu.name, tu.input)
                  yield* dispatch(Action.ToolResult({ id: tu.toolUseId, result }))
                }),
              )
              calls[tu.toolUseId] = {
                name: tu.name,
                input: tu.input,
                fiber,
              }
            }

            return State.ToolUse({ events, timestamp: state.timestamp, calls })
          }),
        Abort: ({ events, requestFiber }) =>
          Eff.Effect.gen(function* () {
            // interrupt current request fiber and go back to idle
            yield* Eff.Fiber.interruptFork(requestFiber)

            return State.Idle({
              events,
              timestamp: yield* getNow,
              error: Eff.Option.none(),
            })
          }),
      },
      ToolUse: {
        ToolResult: (state, { id, result }, dispatch) =>
          Eff.Effect.gen(function* () {
            if (!(id in state.calls)) return state

            const calls = { ...state.calls }
            const call = calls[id]
            delete calls[id]

            let events = state.events
            if (Eff.Option.isSome(result)) {
              const event = Event.ToolUse({
                id: yield* genId,
                timestamp: yield* getNow,
                toolUseId: id,
                name: call.name,
                input: call.input,
                result: result.value,
              })
              events = events.concat(event)
            }

            if (Object.keys(calls).length) {
              // some calls still in progress
              return State.ToolUse({ events, timestamp: state.timestamp, calls })
            }

            // all calls completed, send results back to LLM
            const requestFiber = yield* Actor.forkRequest(
              llmRequest(events),
              dispatch,
              (r) => Eff.Effect.succeed(Action.LLMResponse(r)),
              (error) => Eff.Effect.succeed(Action.LLMError({ error })),
            )

            return State.WaitingForAssistant({
              events,
              timestamp: yield* getNow,
              requestFiber,
            })
          }),
        Abort: ({ events, calls }) =>
          Eff.Effect.gen(function* () {
            // interrupt current tool use fibers and go back to idle
            yield* Eff.pipe(
              calls,
              Eff.Record.collect((_k, v) => v.fiber),
              Eff.Array.map(Eff.Fiber.interruptFork),
              Eff.Effect.all,
            )

            return State.Idle({
              events,
              timestamp: yield* getNow,
              error: Eff.Option.none(),
            })
          }),
      },
    }),
  ),
)

const NAME = 'Qurator'

const SYSTEM = `
You are ${NAME}, an AI assistant created by Quilt Data.
Your primary purpose is assisting users of Quilt Data products.
Persona: conservative and creative scientist.
`

// TODO: mention the client company?
const TASK_CONTEXT = XML.tag(
  'task-context',
  {},
  'You act as a chatbot deployed on the Quilt Catalog web app.',
  'You have access to the the Quilt Catalog UI via context and tools.',
).toString()

// detailed task description and rules
const TASK_DESCRIPTION = XML.tag(
  'task-description',
  {},
  'When asked a question about Quilt or Quilt Data, refer to the documentation at https://docs.quilt.bio.',
).toString()

const CONVERSATION_START = `
Following is the conversation history:
### CONVERSATION START ###
`

const CONVERSATION_END = `
### CONVERSATION END ###
`

const IMMEDIATE_TASK = `
Advance the provided conversation in the most helpful way possible.
Use tools proactively, but don't mention that unnecessarily, so that it feels transparent.

Think step by step and carefully analyze the provided context to prevent giving
incomplete or inaccurate information.

Never make things up, always double-check your responses and use the context
to your advantage.

Use GitHub Flavored Markdown syntax for formatting when appropriate.
`

export const constructPrompt = (
  events: Event[],
  context: Context.ContextShape,
): Eff.Effect.Effect<LLM.Prompt> =>
  Log.scoped({
    name: `${MODULE}.constructPrompt`,
    enter: [Log.br, 'events:', events, Log.br, 'context:', context],
  })(
    Eff.Effect.gen(function* () {
      // XXX: add context about quilt products?
      // XXX: add context about catalog structure and features?

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
            Content.PromptMessageContentBlock.ToolResult({ toolUseId, ...result }),
          ),
        ],
      )

      const currentTime = (yield* getNow).toISOString()

      // prompt structure
      // - task context
      // - tone context
      // - Background data, documents, and images
      // - detailed task description and rules
      // - examples
      // - input data
      //   - conversation history
      //   - user input
      // - immediate task
      // - precognition
      // - output formatting
      // - prefill
      const messages: Eff.Array.NonEmptyArray<LLM.PromptMessage> = [
        LLM.userMessage(
          Content.text(
            TASK_CONTEXT,
            TASK_DESCRIPTION,
            XML.tag('context', {}, ...context.messages).toString(),
            XML.tag('current-time', {}, currentTime).toString(),
            CONVERSATION_START,
          ),
        ),
        ...msgEvents.map(({ role, content }) => LLM.PromptMessage({ role, content })),
        LLM.userMessage(Content.text(CONVERSATION_END, IMMEDIATE_TASK)),
        ...toolMessages,
      ]

      return {
        system: SYSTEM,
        messages,
        toolConfig: { tools: context.tools },
      }
    }),
  )
