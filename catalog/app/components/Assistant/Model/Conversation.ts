import * as Eff from 'effect'
import * as uuid from 'uuid'

import * as Actor from 'utils/Actor'
import * as Log from 'utils/Logging'
import * as XML from 'utils/XML'

import * as Connectors from './Connectors'
import * as Content from './Content'
import * as Context from './Context'
import * as LLM from './LLM'
import * as PromptContract from './PromptContract'
import * as Tool from './Tool'

const MODULE = 'Conversation'

// TODO: make this a globally available service?
const genId = Eff.Effect.sync(uuid.v4)

// TODO: use effect/DateTime after upgrading
const getNow = Eff.Clock.currentTimeMillis.pipe(Eff.Effect.map((t) => new Date(t)))

export interface ToolCall {
  readonly name: string
  readonly input: Record<string, any>
  /** Absent while the call waits for the user's approval. */
  readonly fiber?: Eff.Fiber.RuntimeFiber<void>
  /** Set while the call waits for the user's approval. */
  readonly approval?: Exclude<Tool.Effect, 'read'>
  /** The tool when approval was asked; Approve refuses to run if it differs. */
  readonly tool?: Tool.Descriptor<any>
  /**
   * Ours, not the model's: Run and Don't run name it, so an answer can only
   * settle the card it was clicked on, even if the model reuses a tool-use id.
   */
  readonly key?: string
}

const sameTool = (a: Tool.Descriptor<any>, b: Tool.Descriptor<any> | undefined) =>
  !!b &&
  a.effect === b.effect &&
  a.description === b.description &&
  JSON.stringify(a.schema) === JSON.stringify(b.schema)

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

  /**
   * One or more connectors are blocked (transient or needs-ack); the
   * conversation pauses before the next LLM round-trip. The waiter
   * fiber dispatches `ConnectorReady` once `connectors.awaitUnblocked`
   * resolves. UI gates input and renders connector status independently
   * — this state carries no per-connector snapshot.
   */
  AwaitingConnector: StateBase & {
    readonly waiter: Eff.Fiber.RuntimeFiber<void>
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
  Approve: { readonly id: string; readonly key: string }
  Deny: { readonly id: string; readonly key: string }
  Abort: {}
  Clear: {}
  Discard: { readonly id: string }
  ConnectorReady: {}
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

// Rough chars-not-tokens proxy -- no tokenizer exists in this codebase, and
// Nemotron Lightning's 65536-token limit is only ever learned from the error
// body (qhq-pvw9), not declared anywhere locally. Sized with real headroom
// (a token averages several chars) so the estimate doesn't need to be exact,
// just enough to break the stuck-retry loop below before the model errors.
const MAX_PROMPT_CHARS = 120_000

// Floor for "room for one small event plus the prompt contract's fixed text"
// (system, task context and description, conversation markers, immediate
// task; none individually counted) -- generous on purpose.
const MIN_EVENT_ROOM = 3_000

/**
 * byteLength of a content block's binary source, or 0 for a string (counted
 * by JSON.stringify instead). JSON.stringify on a Buffer/Uint8Array emits
 * one key per byte (wildly overcounting); on a Blob it emits `{}` (wildly
 * undercounting -- a multi-MB image would read as near-free and never get
 * trimmed, defeating the point). Image/Document blocks have the same
 * {source} shape in both MessageContentBlock and ToolResultContentBlock, so
 * this is typed structurally rather than against either union specifically.
 */
const binarySourceSize = (block: {
  _tag: string
  source?: Buffer | Uint8Array | Blob | string
}): number => {
  if ((block._tag !== 'Image' && block._tag !== 'Document') || !block.source) return 0
  const { source } = block
  if (typeof source === 'string') return 0
  if (source instanceof Blob) return source.size
  return source.byteLength
}

// Events are never mutated after creation (ToolUse.ToolResult and Idle.Ask
// only ever concat a new Event; Discard replaces with a new object via
// spread) -- so each event's size is stable for its whole lifetime, and
// caching by identity is safe. Without this, llmRequest would re-stringify
// `state.events` on every round, and state.events itself is never trimmed
// (only the local, trimmed copy passed to constructPrompt is) -- so an
// uncached eventSize would redo JSON.stringify over the whole,
// ever-growing history on every single turn of a long session.
const eventSizeCache = new WeakMap<Event, number>()

/** Rough serialized-size estimate for one event, correcting for binary content. */
const eventSize = (e: Event): number => {
  const cached = eventSizeCache.get(e)
  if (cached !== undefined) return cached
  const blocks = e._tag === 'Message' ? [e.content] : e.result.content
  const binary = blocks.reduce((sum, b) => sum + binarySourceSize(b), 0)
  // JSON.stringify of a Buffer/Uint8Array/Blob source is also included in
  // this total, but it's small relative to `binary` either way (over- or
  // under-counting by the same byte source), so no need to strip it out.
  const size = JSON.stringify(e).length + binary
  eventSizeCache.set(e, size)
  return size
}

/**
 * Drop the oldest events until the estimated total fits MAX_PROMPT_CHARS,
 * keeping the most recent ones (the ones most likely to matter for the next
 * reply). Without this, a long tool-call retry loop fills `events` past the
 * model's context window; the LLM call fails (qhq-pvw9), degrades to Idle,
 * but `events` is unchanged -- so every subsequent Ask rebuilds the identical
 * oversized prompt and fails identically, forever. Trimming here, not just
 * once after an error, means it never gets that far.
 *
 * Trims whole Events, so a ToolUse's call and result (one record here) can
 * never be split apart. constructPrompt's own pre-existing msgEvents/
 * toolMessages split (unrelated to this trim, true on master before it)
 * means the surviving suffix's true chronological order isn't fully
 * reflected in the assembled prompt either way -- a known, pre-existing
 * property of constructPrompt, not something this trim introduces or fixes.
 *
 * Pass `reservedChars` for context.messages/context.tools (stack info,
 * guidance text, connector schemas) -- without it, a workspace with many
 * connectors or long guidance could exceed the model's real limit even
 * with `events` comfortably under maxChars on its own, since those feed
 * into the same prompt alongside events.
 */
export const trimEventsToBudget = (
  events: Event[],
  maxChars: number = MAX_PROMPT_CHARS,
  reservedChars = 0,
): Event[] => {
  if (!events.length) return events
  const budget = Math.max(0, maxChars - reservedChars)
  let total = 0
  // eventSize is cached per-event (see eventSizeCache above), so mapping
  // the whole array here costs a WeakMap lookup per already-seen event,
  // not a re-stringify -- `events` itself (state.events) is never
  // trimmed, so this would otherwise redo the full history's JSON.stringify
  // on every single Ask/ToolResult of a long session.
  const sizes = events.map(eventSize)
  // Always keep at least the most recent event, even if it alone exceeds
  // budget on its own -- an empty prompt is worse than an oversized one.
  for (let i = sizes.length - 1; i > 0; i -= 1) {
    total += sizes[i]
    if (total + sizes[i - 1] > budget) return events.slice(i)
  }
  return events
}

const llmRequest = (events: Event[]) =>
  Log.scoped({
    name: `${MODULE}.llmRequest`,
    enter: [Log.br, 'events:', events],
  })(
    Eff.Effect.gen(function* () {
      const llm = yield* LLM.LLM
      const ctxService = yield* Context.ConversationContext
      const reactCtx = yield* ctxService.context
      const connectors = yield* Connectors.Connectors
      const connectorsCtx = yield* connectors.contextContribution
      const ctx = Context.forMode(Context.merge(reactCtx, connectorsCtx))
      // Reserve room for context.messages/tools (stack info, guidance text,
      // connector schemas) so the budget below reflects the whole prompt,
      // not just events -- a workspace with many connectors or long
      // guidance text can be a large, mostly-fixed share of it on its own.
      const reservedChars =
        JSON.stringify(ctx.messages).length +
        JSON.stringify(ctx.tools).length +
        (ctx.prompt ? PromptContract.fixedLength(ctx.prompt) : 0)
      // trimEventsToBudget can only shrink `events`, never ctx.messages/
      // tools -- so if reservedChars alone leaves less than MIN_EVENT_ROOM,
      // the always-keep-one-event guarantee still sends a doomed prompt.
      if (reservedChars + MIN_EVENT_ROOM > MAX_PROMPT_CHARS) {
        return yield* Eff.Effect.fail(
          new LLM.LLMError({
            message:
              'This page has too much fixed context (package files, instructions, or ' +
              'enabled connectors) for the model to leave any room for conversation. ' +
              'Try a smaller package directory, shorter admin/personal instructions, or ' +
              'fewer connectors.',
          }),
        )
      }
      const filteredEvents = trimEventsToBudget(
        events.filter((e) => !e.discarded),
        MAX_PROMPT_CHARS,
        reservedChars,
      )
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

const currentTools = Eff.Effect.gen(function* () {
  const ctxService = yield* Context.ConversationContext
  const reactCtx = yield* ctxService.context
  const connectors = yield* Connectors.Connectors
  const connectorsCtx = yield* connectors.contextContribution
  return Context.forMode(Context.merge(reactCtx, connectorsCtx)).tools
})

const forkCall = (
  tools: Tool.Collection,
  id: string,
  name: string,
  input: unknown,
  dispatch: Actor.Dispatch<Action>,
) =>
  Eff.Effect.fork(
    Eff.Effect.gen(function* () {
      // Eff.Effect.suspend, not a direct call: Tool.execute runs the
      // executor synchronously (it's a plain function, not Effect.sync/try),
      // so a throwing executor would otherwise throw before any Effect
      // value exists for catchAllDefect to attach to -- suspend defers that
      // call into the Effect's own execution so the throw becomes a defect
      // this fiber can actually catch, instead of an unhandled synchronous
      // exception. catchAllDefect (not catchAll, and not catchAllCause):
      // Tool.execute's own tools already catch typed failures, and
      // catchAllCause would also swallow Abort's Eff.Fiber.interruptFork on
      // this same fiber, turning a real interruption into a normal
      // ToolResult dispatch instead of letting the fiber actually die.
      // Without this guard, a defect here would otherwise leave this
      // toolUseId's `calls` entry stuck forever -- nothing else ever
      // removes it, so the conversation hangs in ToolUse with no error
      // surfaced (qhq-62tw).
      const result = yield* Eff.Effect.suspend(() =>
        Tool.execute(tools, name, input),
      ).pipe(
        Eff.Effect.catchAllDefect((defect) =>
          Eff.Effect.succeed(
            Eff.Option.some(
              Tool.fail(
                Content.ToolResultContentBlock.Text({
                  // Only .message, never the full defect/cause: this text
                  // renders directly in the user-visible ToolMessage UI, and
                  // a defect can carry a stack trace or internal values.
                  text: `Tool "${name}" failed unexpectedly: ${
                    defect instanceof Error ? defect.message : String(defect)
                  }`,
                }),
              ),
            ),
          ),
        ),
      )
      yield* dispatch(Action.ToolResult({ id, result }))
    }),
  )

/**
 * After all tools resolve OR a user Ask lands, decide whether to fire
 * the next LLM round or pause for a blocked connector. Reads
 * `connectors.isBlocked` synchronously — handlers must not yield on
 * async observations. If blocked, forks a waiter that dispatches
 * `ConnectorReady` on unblock and returns AwaitingConnector. Otherwise
 * forks the LLM request.
 */
const advanceFromEvents = (
  events: Event[],
  dispatch: Actor.Dispatch<Action>,
): Eff.Effect.Effect<
  State,
  never,
  LLM.LLM | Context.ConversationContext | Connectors.Connectors
> =>
  Eff.Effect.gen(function* () {
    const connectors = yield* Connectors.Connectors
    const blocked = yield* connectors.isBlocked
    const timestamp = yield* getNow
    if (blocked) {
      const waiter = yield* Eff.Effect.fork(
        Eff.Effect.gen(function* () {
          yield* connectors.awaitUnblocked
          yield* dispatch(Action.ConnectorReady())
        }),
      )
      return State.AwaitingConnector({ events, timestamp, waiter })
    }
    const requestFiber = yield* Actor.forkRequest(
      llmRequest(events),
      dispatch,
      (r) => Eff.Effect.succeed(Action.LLMResponse(r)),
      (error) => Eff.Effect.succeed(Action.LLMError({ error })),
    )
    return State.WaitingForAssistant({ events, timestamp, requestFiber })
  })

type ToolUseState = Extract<State, { _tag: 'ToolUse' }>

const completeCall = (
  state: ToolUseState,
  id: string,
  result: Tool.ResultOption,
  dispatch: Actor.Dispatch<Action>,
) =>
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

    // all calls completed: gate on connectors before the next LLM round
    return yield* advanceFromEvents(events, dispatch)
  })

// XXX: separate "service" from handlers
export const ConversationActor = Eff.Effect.succeed(
  Log.scopedFn(`${MODULE}.ConversationActor`)(
    Actor.taggedHandler<
      State,
      Action,
      LLM.LLM | Context.ConversationContext | Connectors.Connectors
    >({
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
            return yield* advanceFromEvents(events, dispatch)
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

            // Results are matched to calls by id, so a repeated id would let one
            // call's result settle another (e.g. a read clearing a write's card),
            // and an id like `__proto__` is not an own key of the calls record.
            const ids = toolUses.map((tu) => tu.toolUseId)
            if (new Set(ids).size !== ids.length || ids.some((id) => id in {})) {
              return yield* idle(events, {
                message: 'Qurator stopped: the model sent an unusable tool-call id.',
                details: 'No tools were run. Ask again to continue.',
              })
            }

            const tools = yield* currentTools
            const calls: Record<string, ToolCall> = {}
            for (const tu of toolUses) {
              const effect = Eff.Record.has(tools, tu.name)
                ? tools[tu.name].effect
                : undefined
              if (effect && effect !== 'read') {
                calls[tu.toolUseId] = {
                  name: tu.name,
                  input: tu.input,
                  approval: effect,
                  tool: tools[tu.name],
                  key: yield* genId,
                }
                continue
              }
              calls[tu.toolUseId] = {
                name: tu.name,
                input: tu.input,
                fiber: yield* forkCall(tools, tu.toolUseId, tu.name, tu.input, dispatch),
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
          completeCall(state, id, result, dispatch),
        Approve: (state, { id, key }, dispatch) =>
          Eff.Effect.gen(function* () {
            const call = state.calls[id]
            if (!call?.approval || call.key !== key) return state
            const tools = yield* currentTools
            const current = Eff.Record.has(tools, call.name)
              ? tools[call.name]
              : undefined
            if (!call.tool || !sameTool(call.tool, current)) {
              const result = Tool.fail(
                Content.ToolResultContentBlock.Text({
                  text: current
                    ? 'The tool changed while waiting for approval; it was not run.'
                    : "The tool isn't available right now; it was not run.",
                }),
              )
              return yield* completeCall(state, id, Eff.Option.some(result), dispatch)
            }
            const fiber = yield* forkCall(tools, id, call.name, call.input, dispatch)
            return {
              ...state,
              calls: {
                ...state.calls,
                [id]: { name: call.name, input: call.input, fiber },
              },
            }
          }),
        Deny: (state, { id, key }, dispatch) =>
          Eff.Effect.gen(function* () {
            const call = state.calls[id]
            if (!call?.approval || call.key !== key) return state
            const result = Tool.fail(
              Content.ToolResultContentBlock.Text({
                text: 'Declined by the user; do not retry unless asked.',
              }),
            )
            return yield* completeCall(state, id, Eff.Option.some(result), dispatch)
          }),
        Abort: ({ events, calls }) =>
          Eff.Effect.gen(function* () {
            // interrupt current tool use fibers and go back to idle
            yield* Eff.pipe(
              calls,
              Eff.Record.collect((_k, v) => v.fiber),
              Eff.Array.filter(Eff.Predicate.isNotUndefined),
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
      AwaitingConnector: {
        ConnectorReady: ({ events }, _action, dispatch) =>
          advanceFromEvents(events, dispatch),
        Abort: ({ events, waiter }) =>
          Eff.Effect.gen(function* () {
            yield* Eff.Fiber.interruptFork(waiter)
            return State.Idle({
              events,
              timestamp: yield* getNow,
              error: Eff.Option.none(),
            })
          }),
        Clear: ({ waiter }) =>
          Eff.Effect.gen(function* () {
            yield* Eff.Fiber.interruptFork(waiter)
            return yield* idle([])
          }),
        Discard: (state, { id }) =>
          Eff.Effect.succeed({
            ...state,
            events: state.events.map((e) =>
              e.id === id ? { ...e, discarded: true } : e,
            ),
          }),
      },
    }),
  ),
)

/**
 * Frame the conversation with the registry's prompt contract, filling its
 * slots from the context; fails when the contract has not been served.
 */
export const constructPrompt = (
  events: Event[],
  context: Context.ContextShape,
): Eff.Effect.Effect<LLM.Prompt, LLM.LLMError> =>
  Log.scoped({
    name: `${MODULE}.constructPrompt`,
    enter: [Log.br, 'events:', events, Log.br, 'context:', context],
  })(
    Eff.Effect.gen(function* () {
      const contract = context.prompt
      if (!contract) {
        return yield* Eff.Effect.fail(
          new LLM.LLMError({ message: PromptContract.UNAVAILABLE }),
        )
      }

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
            contract.taskContext,
            contract.taskDescription,
            XML.tag('context', {}, ...context.messages).toString(),
            XML.tag('current-time', {}, currentTime).toString(),
            contract.conversationStart,
          ),
        ),
        ...msgEvents.map(({ role, content }) => LLM.PromptMessage({ role, content })),
        LLM.userMessage(Content.text(contract.conversationEnd, contract.immediateTask)),
        ...toolMessages,
      ]

      return {
        system: contract.system,
        messages,
        toolConfig: { tools: context.tools },
      }
    }),
  )
