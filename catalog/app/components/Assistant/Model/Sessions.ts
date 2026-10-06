import * as Eff from 'effect'

import * as Content from './Content'
import * as Conversation from './Conversation'

/**
 * Image and document blocks are saved as a placeholder, so object bytes never
 * outlive the request that fetched them under the user's own permissions.
 */

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
    timestamp: S.String,
    role: S.Literal('user', 'assistant'),
    content: Text,
  }),
  S.Struct({
    _tag: S.Literal('ToolUse'),
    id: S.String,
    timestamp: S.String,
    toolUseId: S.String,
    name: S.String,
    input: S.Record({ key: S.String, value: S.Unknown }),
    result: S.Struct({
      status: S.Literal('success', 'error'),
      content: S.Array(S.Union(Text, Json)),
    }),
  }),
)
type StoredEvent = typeof StoredEvent.Type

const Envelope = S.Struct({ v: S.Literal(1), events: S.Array(StoredEvent) })
export type Envelope = typeof Envelope.Type

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
          timestamp: new Date(e.timestamp),
          role: e.role,
          content: Content.MessageContentBlock.Text({ text: e.content.text }),
        })
      : Conversation.Event.ToolUse({
          id: e.id,
          timestamp: new Date(e.timestamp),
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

export interface Session {
  id: string
  title: string
  updatedAt: string
  envelope: Envelope
}

export const MAX_SESSIONS = 20
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

/**
 * One key per username, so the next account signed in to this browser never
 * sees them.
 *
 * ponytail: one JSON blob per user, rewritten on each save; a quota error drops
 * the oldest until the write fits. A server-side store replaces it.
 */
const KEY = 'qurator.sessions'
const ENABLED_KEY = 'qurator.sessions.enabled'

const scoped = (key: string, username: string) => `${key}:${username}`

function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function list(username: string): Session[] {
  const all = readJson(scoped(KEY, username))
  return Array.isArray(all) ? (all as Session[]) : []
}

function write(username: string, sessions: Session[]) {
  for (let keep = sessions.length; keep > 0; keep -= 1) {
    try {
      window.localStorage.setItem(
        scoped(KEY, username),
        JSON.stringify(sessions.slice(0, keep)),
      )
      return
    } catch {
      // quota exceeded (or storage blocked): retry without the oldest
    }
  }
  try {
    window.localStorage.removeItem(scoped(KEY, username))
  } catch {
    // storage unavailable: sessions are simply not kept
  }
}

export function save(username: string, session: Session) {
  const rest = list(username).filter((s) => s.id !== session.id)
  write(username, [session, ...rest].slice(0, MAX_SESSIONS))
}

export function remove(username: string, id: string) {
  write(
    username,
    list(username).filter((s) => s.id !== id),
  )
}

export function isEnabled(username: string) {
  return !!readJson(scoped(ENABLED_KEY, username))
}

export function setEnabled(username: string, enabled: boolean) {
  try {
    if (enabled) window.localStorage.setItem(scoped(ENABLED_KEY, username), 'true')
    else {
      window.localStorage.removeItem(scoped(ENABLED_KEY, username))
      window.localStorage.removeItem(scoped(KEY, username))
    }
  } catch {
    // storage unavailable
  }
}
