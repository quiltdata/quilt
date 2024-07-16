import * as Eff from 'effect'
import * as uuid from 'uuid'

import * as Actor from 'utils/Actor'
import * as Log from 'utils/Logging'

import * as Content from './Content'
import * as Context from './Context'
import * as LLM from './LLM'
import * as Tool from './Tool'

const MODULE = 'Assistant/Conversation'

// TODO: make this a globally available service?
const genId = Eff.Effect.sync(uuid.v4)

interface ToolCall {
  readonly name: string
  readonly input: Record<string, any>
  readonly fiber: Eff.Fiber.RuntimeFiber<void>
}

interface EventBase {
  readonly id: string
  readonly timestamp: Date
}

// XXX: add "aborted" event?
export type Event = Eff.Data.TaggedEnum<{
  // XXX: add trace/debug level?
  // Notification: EventBase & {
  //   readonly severity: 'info' | 'warning' | 'error'
  //   readonly content: string
  // }
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

export type State = Eff.Data.TaggedEnum<{
  /**
   * Waiting for user input
   */
  Idle: {
    readonly events: Event[]
    readonly error: Eff.Option.Option<{
      message: string
      details: string
    }>
  }

  /**
   * Waiting for assistant (LLM) to respond
   */
  WaitingForAssistant: {
    readonly events: Event[]
    readonly requestFiber: Eff.Fiber.RuntimeFiber<boolean>
  }

  /**
   * Tool use in progress
   */
  ToolUse: {
    readonly events: Event[]
    // TODO: use HashMap?
    readonly calls: Record<string, ToolCall>
    // readonly retries: number
  }
}>

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const State = Eff.Data.taggedEnum<State>()

export type Action = Eff.Data.TaggedEnum<{
  Ask: {
    readonly content: string
  }
  LLMError: {
    readonly error: Eff.Cause.UnknownException
  }
  LLMResponse: {
    readonly timestamp: Date
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

export const init = State.Idle({
  events: [],
  error: Eff.Option.none(),
})

const llmRequest = (events: Event[]) =>
  Log.scoped({
    name: `${MODULE}.ConversationActor:llmRequest`,
    enter: [Log.br, 'events:', events],
  })(
    Eff.Effect.gen(function* () {
      const llm = yield* LLM.LLM
      const ctxService = yield* Context.ConversationContext
      const ctx = yield* ctxService.context
      const prompt = yield* constructPrompt(events, ctx)

      const response = yield* llm.converse(prompt)

      if (Eff.Option.isNone(response.content)) {
        const error = new Eff.Cause.UnknownException(
          new Error('No content in LLM response'),
        )
        yield* error
        throw error // won't actually throw
      }

      const [toolUses, content] = Eff.Array.partitionMap(response.content.value, (c) =>
        c._tag === 'ToolUse' ? Eff.Either.left(c) : Eff.Either.right(c),
      )

      const timestamp = new Date(yield* Eff.Clock.currentTimeMillis)
      // XXX: record response stats?
      return { timestamp, content, toolUses }
    }),
  )

// XXX: separate "service" from handlers
export const ConversationActor = Eff.Effect.succeed(
  Log.scopedFn(`${MODULE}.ConversationActor`)(
    Actor.taggedHandler<State, Action, LLM.LLM | Context.ConversationContext>({
      Idle: {
        Ask: (state, action, dispatch) =>
          Eff.Effect.gen(function* () {
            const event = Event.Message({
              id: yield* genId,
              timestamp: new Date(yield* Eff.Clock.currentTimeMillis),
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
            return State.WaitingForAssistant({ events, requestFiber })
          }),

        Clear: () =>
          Eff.Effect.succeed(State.Idle({ events: [], error: Eff.Option.none() })),
        Discard: (state, { id }) =>
          Eff.Effect.succeed({
            ...state,
            events: state.events.filter((e) => e.id !== id),
          }),
      },
      WaitingForAssistant: {
        LLMError: (state, { error }) =>
          Eff.Effect.gen(function* () {
            return State.Idle({
              events: state.events,
              error: Eff.Option.some({
                message: 'Error while interacting with LLM. Please try again.',
                details: `${error}`,
              }),
            })
          }),
        LLMResponse: (state, { timestamp, content, toolUses }, dispatch) =>
          Eff.Effect.gen(function* () {
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

            if (!toolUses.length) return State.Idle({ events, error: Eff.Option.none() })

            const ctxService = yield* Context.ConversationContext
            const { tools } = yield* ctxService.context
            const calls: Record<string, ToolCall> = {}
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

            return State.ToolUse({ events, calls })
          }),
        Abort: (state) =>
          Eff.Effect.gen(function* () {
            // TODO: interrupt current request fiber and go back to idle
            return state
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
                timestamp: new Date(yield* Eff.Clock.currentTimeMillis),
                toolUseId: id,
                name: call.name,
                input: call.input,
                result: result.value,
              })
              events = events.concat(event)
            }

            if (Object.keys(calls).length) return State.ToolUse({ events, calls })

            // all calls completed, send results back to LLM
            const requestFiber = yield* Actor.forkRequest(
              llmRequest(events),
              dispatch,
              (r) => Eff.Effect.succeed(Action.LLMResponse(r)),
              (error) => Eff.Effect.succeed(Action.LLMError({ error })),
            )
            return State.WaitingForAssistant({ events, requestFiber })
          }),
        Abort: (state) =>
          Eff.Effect.gen(function* () {
            // TODO: interrupt current request fiber and go back to idle
            return state
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

const TASK_CONTEXT = `
<task-context>
You act as a chatbot deployed on the Quilt Catalog web app.
You have access to the the Quilt Catalog UI via context and tools.
</task-context>
`

// detailed task description and rules
const TASK_DESCRIPTION = `
<task-description>
When asked a question about Quilt or Quilt Data, refer to the documentation at https://docs.quiltdata.com.
</task-description>
`

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

const constructPrompt = (
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
            `<context>\n${context.messages.join('\n')}\n</context>`,
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
