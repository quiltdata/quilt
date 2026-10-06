import * as Eff from 'effect'

import * as Content from './Content'
import * as Conversation from './Conversation'

const S = Eff.Schema

const Text = S.Struct({ _tag: S.Literal('Text'), text: S.String })
const Json = S.Struct({
  _tag: S.Literal('Json'),
  json: S.Record({ key: S.String, value: S.Unknown }),
})

const StoredEvent = S.Union(
  S.Struct({
    _tag: S.Literal('Message'),
    id: S.String,
    timestamp: S.Date,
    role: S.Literal('user', 'assistant'),
    content: Text,
  }),
  S.Struct({
    _tag: S.Literal('ToolUse'),
    id: S.String,
    timestamp: S.Date,
    toolUseId: S.String,
    name: S.String,
    input: S.Record({ key: S.String, value: S.Unknown }),
    result: S.Struct({
      status: S.Literal('success', 'error'),
      content: S.Array(S.Union(Text, Json)),
    }),
  }),
)
type StoredEvent = typeof StoredEvent.Encoded

const Envelope = S.Struct({ v: S.Literal(1), events: S.Array(StoredEvent) })
export type Envelope = typeof Envelope.Encoded

// Image and document bytes stay out of the registry database, outside bucket IAM.
const placeholder = (b: { _tag: 'Image' | 'Document'; format: string; name?: string }) =>
  ({
    _tag: 'Text',
    text:
      b._tag === 'Image'
        ? `[image (${b.format}) not retained in saved sessions]`
        : `[document ${b.name} not retained in saved sessions]`,
  }) as const

const storeBlock = (b: Content.MessageContentBlock | Content.ToolResultContentBlock) =>
  b._tag === 'Image' || b._tag === 'Document'
    ? placeholder(b)
    : b._tag === 'Json'
      ? { _tag: 'Json' as const, json: b.json }
      : { _tag: 'Text' as const, text: b.text }

export function encode(events: readonly Conversation.Event[]): Envelope {
  return {
    v: 1,
    events: events
      .filter((e) => !e.discarded)
      .map(
        Conversation.Event.$match({
          Message: (e): StoredEvent => ({
            _tag: 'Message',
            id: e.id,
            timestamp: e.timestamp.toISOString(),
            role: e.role,
            content: storeBlock(e.content) as typeof Text.Type,
          }),
          ToolUse: (e): StoredEvent => ({
            _tag: 'ToolUse',
            id: e.id,
            timestamp: e.timestamp.toISOString(),
            toolUseId: e.toolUseId,
            name: e.name,
            input: e.input,
            result: {
              status: e.result.status,
              content: e.result.content.map(storeBlock),
            },
          }),
        }),
      ),
  }
}

const restoreBlock = (b: typeof Text.Type | typeof Json.Type) =>
  b._tag === 'Json'
    ? Content.ToolResultContentBlock.Json({ json: b.json as any })
    : Content.ToolResultContentBlock.Text({ text: b.text })

/** `null` when the stored value is not an envelope this build can read. */
export function decode(raw: unknown): Conversation.Event[] | null {
  const parsed = S.decodeUnknownOption(Envelope)(raw)
  if (Eff.Option.isNone(parsed)) return null
  return parsed.value.events.map((e) =>
    e._tag === 'Message'
      ? Conversation.Event.Message({
          id: e.id,
          timestamp: e.timestamp,
          role: e.role,
          content: Content.MessageContentBlock.Text({ text: e.content.text }),
        })
      : Conversation.Event.ToolUse({
          id: e.id,
          timestamp: e.timestamp,
          toolUseId: e.toolUseId,
          name: e.name,
          input: e.input,
          result: {
            status: e.result.status,
            content: e.result.content.map(restoreBlock),
          },
        }),
  )
}

export const TITLE_LENGTH = 80

export function titleOf(events: readonly Conversation.Event[]): string {
  const first = events.find(
    (e) => e._tag === 'Message' && e.role === 'user' && e.content._tag === 'Text',
  )
  const text =
    first?._tag === 'Message' && first.content._tag === 'Text' ? first.content.text : ''
  const line = text.trim().split('\n')[0] || 'Untitled session'
  return line.length > TITLE_LENGTH ? `${line.slice(0, TITLE_LENGTH - 1)}…` : line
}

export type Stop = 'TooLarge' | 'Disabled'

export type SaveOutcome =
  | { readonly _tag: 'Saved'; readonly id: string; readonly version: number }
  | { readonly _tag: 'Conflict' | 'NotFound' | 'Failed' | Stop }

type SaveResult =
  | {
      readonly __typename: 'QuratorSession'
      readonly id: string
      readonly version: number
    }
  | { readonly __typename: 'InvalidInput'; readonly errors: readonly { name: string }[] }
  | { readonly __typename: 'OperationError'; readonly name: string }

const OUTCOMES = ['Conflict', 'NotFound', 'TooLarge', 'Disabled'] as const

export function outcomeOf(r: SaveResult): SaveOutcome {
  if (r.__typename === 'QuratorSession')
    return { _tag: 'Saved', id: r.id, version: r.version }
  const name = r.__typename === 'InvalidInput' ? r.errors[0]?.name : r.name
  const known = OUTCOMES.find((o) => o === name)
  return { _tag: known ?? 'Failed' }
}

export interface SaveRequest<T> {
  readonly id: string | null
  readonly baseVersion: number | null
  readonly events: T
}

interface Slot<T> {
  readonly head: string
  /** The session the conversation on screen is under. */
  shown: string | null
  /** The session the next save writes; null creates one. */
  id: string | null
  version: number | null
  latest: T | null
  sent: T | null
  timer: ReturnType<typeof setTimeout> | null
  inFlight: boolean
  stopped: boolean
  retried: boolean
  waiters: (() => void)[]
}

interface QueueOptions<T> {
  send: (request: SaveRequest<T>) => Promise<SaveOutcome>
  /** A save made while the conversation `head` was under `basis` stored it as `id`. */
  onCreated: (created: { head: string; basis: string | null; id: string }) => void
  onStopped: (head: string, reason: Stop) => void
  delayMs?: number
}

/**
 * One save in flight at a time, so a tab never conflicts with its own writes.
 * A `Conflict` or `NotFound` saves the conversation as a new session rather
 * than overwriting or losing it.
 */
export function createSaveQueue<T>({
  send,
  onCreated,
  onStopped,
  delayMs = 1000,
}: QueueOptions<T>) {
  let slot: Slot<T> | null = null

  const later = (s: Slot<T>, ms: number) => {
    if (s.timer) clearTimeout(s.timer)
    s.timer = setTimeout(() => {
      s.timer = null
      pump(s)
    }, ms)
  }

  const pump = (s: Slot<T>) => {
    if (s.inFlight || s.timer) return
    if (s.stopped || !s.latest || s.latest === s.sent) {
      s.waiters.splice(0).forEach((resolve) => resolve())
      return
    }
    const events = s.latest
    s.inFlight = true
    s.sent = events
    send({ id: s.id, baseVersion: s.version, events })
      .catch((): SaveOutcome => ({ _tag: 'Failed' }))
      .then((r) => {
        s.inFlight = false
        switch (r._tag) {
          case 'Saved':
            s.id = r.id
            s.version = r.version
            s.retried = false
            if (r.id !== s.shown) {
              onCreated({ head: s.head, basis: s.shown, id: r.id })
              s.shown = r.id
            }
            break
          case 'Conflict':
          case 'NotFound':
            s.id = null
            s.version = null
            s.sent = null
            break
          case 'TooLarge':
            s.stopped = true
            onStopped(s.head, r._tag)
            break
          case 'Disabled':
            onStopped(s.head, r._tag)
            break
          case 'Failed':
            // Once, so the last reply of a turn survives a blip; after that,
            // the next change retries, never a loop.
            if (!s.retried) {
              s.retried = true
              s.sent = null
              later(s, delayMs * 5)
            }
            break
        }
        pump(s)
      })
  }

  /** Sends what is pending now; settles once nothing is pending or in flight. */
  const flush = () =>
    new Promise<void>((resolve) => {
      if (!slot) return resolve()
      slot.waiters.push(resolve)
      if (slot.timer) clearTimeout(slot.timer)
      slot.timer = null
      pump(slot)
    })

  const fresh = (
    head: string,
    id: string | null,
    version: number | null,
    events: T | null,
  ) => {
    flush()
    slot = {
      head,
      shown: id,
      id,
      version,
      latest: events,
      sent: events,
      timer: null,
      inFlight: false,
      stopped: false,
      retried: false,
      waiters: [],
    }
    return slot
  }

  return {
    /** The conversation whose first event is `head` now holds `events`. */
    change(head: string, events: T) {
      const s = slot?.head === head ? slot : fresh(head, null, null, null)
      if (s.stopped || s.latest === events) return
      s.latest = events
      later(s, delayMs)
    },
    /** `events` were just opened as session `id` at `version`. */
    adopt(head: string, id: string, version: number, events: T) {
      fresh(head, id, version, events)
    },
    flush,
    /** Drop the pending save but keep the session, to resume on the next change. */
    pause() {
      if (!slot) return
      if (slot.timer) clearTimeout(slot.timer)
      slot.timer = null
      slot.latest = slot.sent
    },
    /** Drop the pending save and ignore what is in flight. */
    reset() {
      if (slot) {
        if (slot.timer) clearTimeout(slot.timer)
        slot.stopped = true
        slot.waiters.splice(0).forEach((resolve) => resolve())
      }
      slot = null
    },
  }
}
