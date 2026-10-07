import * as Eff from 'effect'

import type * as Model from 'model'

import * as Content from './Content'
import * as Conversation from './Conversation'
import * as SessionPackage from './SessionPackage'

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

// Postgres JSONB refuses NUL and lone surrogates, which a file preview or a query
// row can carry; one such character would make every save of the session fail.
const SURROGATES = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g

const storable = (v: unknown): unknown => {
  if (typeof v === 'string')
    return v
      .split('\u0000')
      .join('')
      .replace(SURROGATES, (m) => (m.length === 2 ? m : '�'))
  if (Array.isArray(v)) return v.map(storable)
  if (v && typeof v === 'object')
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) => [storable(k) as string, storable(x)]),
    )
  return v
}

export function encode(events: readonly Conversation.Event[]): Envelope {
  return storable(encodeRaw(events)) as Envelope
}

function encodeRaw(events: readonly Conversation.Event[]): Envelope {
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

export const CHECKPOINT_MAX_BYTES = 2 * 1024 * 1024

function render(
  events: Conversation.Event[],
  model: string,
  savedAt: Date,
  includeResults: boolean,
) {
  // The stack's private bucket is no user's: the README counts touched buckets, naming none.
  const info = { model, savedAt, bucket: '', includeResults }
  const checkpoint = storable({
    readme: SessionPackage.toReadme(events, info),
    transcript: SessionPackage.toTranscript(events, info),
    session: JSON.parse(SessionPackage.toSessionJson(events, info)),
  }) as Model.GQLTypes.QuratorSessionCheckpointInput
  // Counted as the registry counts it: the three files, `session.json` indented.
  const utf8 = new TextEncoder()
  const bytes = [
    checkpoint.readme,
    checkpoint.transcript,
    JSON.stringify(checkpoint.session, null, 2),
  ].reduce((n, f) => n + utf8.encode(f).length, 0)
  return bytes > CHECKPOINT_MAX_BYTES ? null : checkpoint
}

/**
 * The session as package files, without tool results if that is what fits, or
 * `null` past what the registry takes: the draft is then saved alone.
 */
export const checkpointOf = (
  events: Conversation.Event[],
  model: string,
  savedAt: Date,
) => render(events, model, savedAt, true) ?? render(events, model, savedAt, false)

export const TITLE_LENGTH = 80

export function titleOf(events: readonly Conversation.Event[]): string {
  const first = events.find(
    (e) =>
      !e.discarded &&
      e._tag === 'Message' &&
      e.role === 'user' &&
      e.content._tag === 'Text',
  )
  const text =
    first?._tag === 'Message' && first.content._tag === 'Text' ? first.content.text : ''
  const line = text.trim().split(/\r?\n/)[0] || 'Untitled session'
  // By code point: a cut surrogate pair is text the registry cannot store.
  const chars = Array.from(line)
  return chars.length > TITLE_LENGTH
    ? `${chars.slice(0, TITLE_LENGTH - 1).join('')}…`
    : line
}

export type Stop = 'TooLarge' | 'BadEnvelope' | 'Disabled'

export type SaveOutcome =
  | {
      readonly _tag: 'Saved'
      readonly id: string
      readonly version: number
      /** The package holds this save. */
      readonly packaged: boolean
    }
  | { readonly _tag: 'Conflict' | 'NotFound' | 'Failed' | 'CheckpointTooLarge' | Stop }

type SaveResult =
  | {
      readonly __typename: 'QuratorSession'
      readonly id: string
      readonly version: number
      readonly updatedAt: Date
      readonly package: { readonly revisedAt: Date } | null
    }
  | {
      readonly __typename: 'InvalidInput'
      readonly errors: readonly { name: string; path?: string | null }[]
    }
  | { readonly __typename: 'OperationError'; readonly name: string }

const OUTCOMES = ['Conflict', 'NotFound', 'TooLarge', 'BadEnvelope', 'Disabled'] as const

/** A package revised before the session's last save lags it, as when a push failed. */
const isPackaged = (s: { updatedAt: Date; package: { revisedAt: Date } | null }) =>
  !!s.package && s.package.revisedAt >= s.updatedAt

export function outcomeOf(r: SaveResult): SaveOutcome {
  if (r.__typename === 'QuratorSession')
    return { _tag: 'Saved', id: r.id, version: r.version, packaged: isPackaged(r) }
  if (
    r.__typename === 'InvalidInput' &&
    r.errors[0]?.name === 'TooLarge' &&
    r.errors[0]?.path === 'input.checkpoint'
  )
    return { _tag: 'CheckpointTooLarge' }
  const name = r.__typename === 'InvalidInput' ? r.errors[0]?.name : r.name
  const known = OUTCOMES.find((o) => o === name)
  return { _tag: known ?? 'Failed' }
}

export interface SaveRequest<T> {
  readonly id: string | null
  readonly baseVersion: number | null
  readonly events: T
  /** Also cut a package revision from `events`. */
  readonly checkpoint?: true
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
  /** What the package last got; `checkpointDue` asks for the latest. */
  checkpointed: T | null
  checkpointDue: boolean
  idle: ReturnType<typeof setTimeout> | null
  cap: ReturnType<typeof setTimeout> | null
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
  /** Never created as a session; an existing one is still saved empty. */
  isEmpty?: (events: T) => boolean
  delayMs?: number
  /** A checkpoint is cut this long after the last change… */
  idleMs?: number
  /** …and at least this often while changes keep coming. */
  capMs?: number
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
  isEmpty = () => false,
  delayMs = 1000,
  idleMs = 60_000,
  capMs = 300_000,
}: QueueOptions<T>) {
  let slot: Slot<T> | null = null
  // The current slot, and earlier ones whose save may still be in flight.
  const slots = new Set<Slot<T>>()
  const held = new Set<string>()
  let paused = false

  const later = (s: Slot<T>, ms: number) => {
    if (s.timer) clearTimeout(s.timer)
    s.timer = setTimeout(() => {
      s.timer = null
      pump(s)
    }, ms)
  }

  const pump = (s: Slot<T>) => {
    if (s.inFlight) return
    // A flush does not wait out a retry delay: it sends now.
    if (s.timer && s.waiters.length) {
      clearTimeout(s.timer)
      s.timer = null
    }
    // `shown` too: a fork of a held session must not recreate it either.
    const isHeld = [s.id, s.shown].some((id) => id !== null && held.has(id))
    const events = s.latest
    if (events === s.checkpointed) s.checkpointDue = false
    const checkpoint = s.checkpointDue
    if (
      paused ||
      isHeld ||
      s.timer ||
      s.stopped ||
      !events ||
      // A checkpoint alone never resends a create: one that failed may have been kept.
      (events === s.sent && !(checkpoint && s.id !== null)) ||
      (s.id === null && isEmpty(events))
    ) {
      s.waiters.splice(0).forEach((resolve) => resolve())
      if (s !== slot && !s.timer && !isHeld && !paused) slots.delete(s)
      return
    }
    s.inFlight = true
    const changed = events !== s.sent
    s.sent = events
    s.checkpointDue = false
    const updating = s.id !== null
    send({
      id: s.id,
      baseVersion: s.version,
      events,
      ...(checkpoint ? { checkpoint: true as const } : {}),
    })
      .catch((): SaveOutcome => ({ _tag: 'Failed' }))
      .then((r) => {
        s.inFlight = false
        if (checkpoint && r._tag === 'Saved' && r.packaged) s.checkpointed = events
        switch (r._tag) {
          case 'CheckpointTooLarge':
            // Not checkpointed again until it changes; a draft it carried is resent alone.
            s.checkpointed = events
            if (changed) s.sent = null
            break
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
            // Only an update forks; a create answered so would loop.
            if (!updating) break
            s.id = null
            s.version = null
            s.sent = null
            s.checkpointDue ||= checkpoint
            break
          case 'TooLarge':
          case 'BadEnvelope':
            s.stopped = true
            onStopped(s.head, r._tag)
            break
          case 'Disabled':
            // The caller rereads the switch and pauses; the next change retries.
            onStopped(s.head, r._tag)
            break
          case 'Failed':
            // Once, so the last reply of a turn survives a blip; after that the
            // next change retries. Never a create: one the registry kept
            // despite the error would be made twice.
            if (!s.retried && updating) {
              s.retried = true
              s.sent = null
              // Only a resend carries a failed checkpoint again: re-asking on any reply would loop.
              s.checkpointDue ||= checkpoint
              later(s, delayMs * 5)
            }
            break
        }
        // A reply landing after `pause` must not leave a fork or retry behind.
        if (paused) {
          if (s.timer) clearTimeout(s.timer)
          s.timer = null
          s.latest = s.sent
          s.checkpointDue = false
        }
        pump(s)
      })
  }

  const stopCheckpointTimers = (s: Slot<T>) => {
    if (s.idle) clearTimeout(s.idle)
    if (s.cap) clearTimeout(s.cap)
    s.idle = null
    s.cap = null
  }

  /** Sends now, carrying a checkpoint unless the package already has the latest. */
  const checkpointNow = (s: Slot<T>) => {
    stopCheckpointTimers(s)
    if (paused) return
    if (s.timer) clearTimeout(s.timer)
    s.timer = null
    s.checkpointDue = true
    pump(s)
  }

  /** Sends what is pending now; settles once nothing is pending or in flight. */
  const flush = () =>
    Promise.all(
      [...slots].map(
        (s) =>
          new Promise<void>((resolve) => {
            s.waiters.push(resolve)
            if (s.timer) clearTimeout(s.timer)
            s.timer = null
            pump(s)
          }),
      ),
    ).then(() => {})

  const fresh = (
    head: string,
    id: string | null,
    version: number | null,
    events: T | null,
    checkpointed: T | null,
  ) => {
    // Leaving a conversation checkpoints it. The session being reopened is
    // retired instead: a save now would move it past the version just read.
    slots.forEach((s) => {
      if (id === null || (s.id !== id && s.shown !== id)) return checkpointNow(s)
      stopCheckpointTimers(s)
      if (s.timer) clearTimeout(s.timer)
      s.timer = null
      s.stopped = true
    })
    slot = {
      head,
      shown: id,
      id,
      version,
      latest: events,
      sent: events,
      timer: null,
      checkpointed,
      checkpointDue: false,
      idle: null,
      cap: null,
      inFlight: false,
      stopped: false,
      retried: false,
      waiters: [],
    }
    slots.add(slot)
    return slot
  }

  return {
    /** The conversation whose first event is `head` now holds `events`. */
    change(head: string, events: T) {
      const s = slot?.head === head ? slot : fresh(head, null, null, null, null)
      if (s.stopped || s.latest === events) return
      s.latest = events
      if (paused) return
      later(s, delayMs)
      if (s.idle) clearTimeout(s.idle)
      s.idle = setTimeout(() => checkpointNow(s), idleMs)
      if (!s.cap) s.cap = setTimeout(() => checkpointNow(s), capMs)
    },
    /**
     * `events` were just opened as session `id` at `version`. Not checkpointed
     * until they change: another tab may be writing the session.
     */
    adopt(head: string, id: string, version: number, events: T) {
      fresh(head, id, version, events, events)
    },
    flush,
    /** Checkpoint every conversation with changes the package lacks: the panel closed. */
    checkpoint() {
      slots.forEach(checkpointNow)
    },
    /**
     * Send nothing, not even a retry or a fork, until `resume`, and drop what
     * is pending: after `resume`, the next change saves the conversation as it
     * then stands.
     */
    pause() {
      paused = true
      for (const s of slots) {
        if (s.timer) clearTimeout(s.timer)
        s.timer = null
        s.latest = s.sent
        stopCheckpointTimers(s)
        s.checkpointDue = false
      }
    },
    /** Saving picks up with the next change. */
    resume() {
      paused = false
    },
    /** Send nothing to session `id` while it is being deleted. */
    hold(id: string) {
      held.add(id)
    },
    /** Once deleted, nothing of the conversation it held is saved again. */
    release(id: string, deleted: boolean) {
      held.delete(id)
      for (const s of slots) {
        if (s.id !== id && s.shown !== id) continue
        if (deleted) {
          if (s.timer) clearTimeout(s.timer)
          s.timer = null
          stopCheckpointTimers(s)
          s.stopped = true
        } else if (s.latest !== s.sent || s.checkpointDue) later(s, delayMs)
      }
    },
  }
}
