import * as Content from './Content'
import * as Conversation from './Conversation'

/** Versions `session.json` and `userMeta.qurator`; bump on any breaking change. */
export const FORMAT = 'quilt.qurator.session/1'

// A tool result can be a whole query result set; the transcript is for reading.
const RESULT_PREVIEW = 2000
// Above this `session.json` drops tool result bodies, keeping status and shape.
const MAX_SESSION_JSON = 5_000_000

export type Reference =
  | { kind: 'bucket'; bucket: string }
  | { kind: 'object'; bucket: string; key: string }
  | { kind: 'package'; bucket: string; name: string }

const refId = (r: Reference) =>
  r.kind === 'bucket'
    ? `s3://${r.bucket}`
    : r.kind === 'object'
      ? `s3://${r.bucket}/${r.key}`
      : `quilt+s3://${r.bucket}#package=${r.name}`

const decodeKey = (k: string) => {
  try {
    return decodeURIComponent(k)
  } catch {
    return k
  }
}

function parseUri(s: string): Reference | null {
  const q = s.match(/^quilt\+s3:\/\/([^/#?]+)[^#]*#(?:.*&)?package=([^/&@:]+\/[^/&@:]+)/)
  if (q) return { kind: 'package', bucket: q[1], name: q[2] }
  const o = s.match(/^s3:\/\/([^/?#]+)\/?([^?#]*)/)
  if (o)
    return o[2]
      ? { kind: 'object', bucket: o[1], key: decodeKey(o[2]) }
      : { kind: 'bucket', bucket: o[1] }
  return null
}

// Platform MCP tools name things by `uri`/`s3_uri` or by `bucket` + `package_name`/`name`/`key`.
function collect(value: unknown, out: Reference[]) {
  if (typeof value === 'string') {
    const r = parseUri(value)
    if (r) out.push(r)
  } else if (Array.isArray(value)) {
    value.forEach((v) => collect(v, out))
  } else if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    if (typeof o.bucket === 'string' && o.bucket) {
      const pkg = [o.package_name, o.name].find(
        (n): n is string => typeof n === 'string' && n.includes('/'),
      )
      if (pkg) out.push({ kind: 'package', bucket: o.bucket, name: pkg })
      else if (typeof o.key === 'string' && o.key)
        out.push({ kind: 'object', bucket: o.bucket, key: o.key })
      else out.push({ kind: 'bucket', bucket: o.bucket })
    }
    Object.values(o).forEach((v) => collect(v, out))
  }
}

const live = (events: Conversation.Event[]) => events.filter((e) => !e.discarded)

/**
 * Whether a tool call's executor ran. A declined approval, or a tool gone or
 * changed while waiting, ends with this marker and reached no data.
 */
export const ran = (e: Conversation.Event) =>
  e._tag === 'ToolUse' &&
  !e.result.content.some(
    (b) =>
      b._tag === 'Text' &&
      (b.text.startsWith('Declined by the user') ||
        /it was not run\.$/.test(b.text) ||
        /^Tool ".*" not found$/.test(b.text)),
  )

/**
 * The first event's id, discarded or not: discarding a message must not make
 * the same conversation look new and stop revising its package.
 */
export const sessionId = (events: Conversation.Event[]) => events[0]?.id ?? ''

// Tool inputs can carry credentials (third-party MCP servers take them as args).
const SECRET =
  /token|secret|password|passwd|authorization|api[-_]?key|credential|access[-_]?key|private[-_]?key|bearer|cookie|jwt|^auth$|^session$/i

// A presigned URL is a credential: anyone holding it reads the object.
const PRESIGNED =
  /https?:\/\/[^\s"'<>]*[?&](?:X-Amz-(?:Signature|Credential)|X-Amz-Security-Token|AWSAccessKeyId|Signature|Key-Pair-Id)=[^\s"'<>]*/gi
const unsign = (s: string) => s.replace(PRESIGNED, '[presigned URL removed]')

function redact(value: unknown): unknown {
  if (typeof value === 'string') return unsign(value)
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        SECRET.test(k) ? '[redacted]' : redact(v),
      ]),
    )
  return value
}

/** What the session's tool calls touched, first mention first, deduplicated. */
export function references(events: Conversation.Event[]): Reference[] {
  const out: Reference[] = []
  live(events).forEach((e) => e._tag === 'ToolUse' && ran(e) && collect(e.input, out))
  const seen = new Set<string>()
  // A bucket is only worth listing when nothing more specific in it was named.
  const specific = new Set(out.filter((r) => r.kind !== 'bucket').map((r) => r.bucket))
  return out.filter((r) => {
    const id = refId(r)
    if (seen.has(id) || (r.kind === 'bucket' && specific.has(r.bucket))) return false
    seen.add(id)
    return true
  })
}

export { refId as referenceId }

// Image and document bytes never leave the browser: a placeholder keeps the shape.
function blockToJson(b: Content.MessageContentBlock | Content.ToolResultContentBlock) {
  switch (b._tag) {
    case 'Text':
      return { type: 'text', text: unsign(b.text) }
    case 'Json':
      return { type: 'json', json: redact(b.json) }
    case 'Image':
      return { type: 'image', format: b.format, omitted: true }
    case 'Document':
      return { type: 'document', format: b.format, name: b.name, omitted: true }
  }
}

function blockToText(b: Content.MessageContentBlock | Content.ToolResultContentBlock) {
  switch (b._tag) {
    case 'Text':
      return unsign(b.text)
    case 'Json':
      return JSON.stringify(redact(b.json), null, 2)
    case 'Image':
      return `[image (${b.format}) omitted]`
    case 'Document':
      return `[document "${b.name}" omitted]`
  }
}

const firstPrompt = (events: Conversation.Event[]) => {
  const e = live(events).find(
    (x) => x._tag === 'Message' && x.role === 'user' && x.content._tag === 'Text',
  )
  return e && e._tag === 'Message' && e.content._tag === 'Text' ? e.content.text : ''
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40)
    .replace(/^-+|-+$/g, '') || 'session'

/**
 * Where a session is saved unless the user picks otherwise: the user's own
 * namespace, and the session id so two sessions never share a package. The one
 * plug point for private scratch once it exists.
 */
export function defaultName(events: Conversation.Event[], now: Date, namespace: string) {
  const id = sessionId(events).slice(0, 6)
  const base = `qurator-${now.toISOString().slice(0, 10)}-${slug(unsign(firstPrompt(events)))}`
  return `${namespace || 'qurator'}/${id ? `${base}-${id}` : base}`
}

export interface SessionInfo {
  model: string
  savedAt: Date
  /** The bucket being saved to: references elsewhere are counted, not named. */
  bucket: string
  /** Off, tool result bodies stay out: they can hold another bucket's data. */
  includeResults: boolean
}

/**
 * Whether a connector call that ran named no bucket at all (a catalog-wide
 * search, a bucket list, an Athena query): its results can hold any bucket's
 * data. Catalog tools (no `<connector>__` prefix, e.g. navigate) read no data.
 */
export const unscoped = (events: Conversation.Event[]) =>
  live(events).some((e) => {
    if (e._tag !== 'ToolUse' || !ran(e) || !e.name.includes('__')) return false
    const out: Reference[] = []
    collect(e.input, out)
    return !out.length
  })

/** Buckets other than the target that the session's tools touched. */
export const foreignBuckets = (events: Conversation.Event[], bucket: string) =>
  Array.from(new Set(references(events).map((r) => r.bucket))).filter((b) => b !== bucket)

const localRefs = (events: Conversation.Event[], bucket: string) =>
  references(events).filter((r) => r.bucket === bucket)

function stats(events: Conversation.Event[]) {
  const ev = live(events)
  return {
    turns: ev.filter((e) => e._tag === 'Message' && e.role === 'user').length,
    toolCalls: ev.filter((e) => e._tag === 'ToolUse').length,
  }
}

export function toSessionJson(events: Conversation.Event[], info: SessionInfo) {
  const serialize = (withResults: boolean) =>
    JSON.stringify(
      {
        format: FORMAT,
        sessionId: sessionId(events),
        savedAt: info.savedAt.toISOString(),
        model: info.model,
        events: live(events).map((e) =>
          e._tag === 'Message'
            ? {
                type: 'message',
                id: e.id,
                timestamp: e.timestamp.toISOString(),
                role: e.role,
                content: blockToJson(e.content),
              }
            : {
                type: 'tool_use',
                id: e.id,
                timestamp: e.timestamp.toISOString(),
                toolUseId: e.toolUseId,
                name: e.name,
                input: redact(e.input),
                result: {
                  status: e.result.status,
                  content: withResults
                    ? e.result.content.map(blockToJson)
                    : [
                        {
                          type: 'omitted',
                          reason: info.includeResults ? 'size' : 'excluded',
                        },
                      ],
                },
              },
        ),
      },
      null,
      2,
    )
  if (!info.includeResults) return serialize(false)
  const full = serialize(true)
  return full.length <= MAX_SESSION_JSON ? full : serialize(false)
}

export function toTranscript(events: Conversation.Event[], info: SessionInfo) {
  const lines = [
    `# Qurator session`,
    '',
    `_${info.savedAt.toISOString()} · ${info.model}_`,
    '',
  ]
  live(events).forEach((e) => {
    if (e._tag === 'Message') {
      lines.push(
        `## ${e.role === 'user' ? 'User' : 'Qurator'}`,
        '',
        blockToText(e.content),
        '',
      )
    } else {
      const result = info.includeResults
        ? e.result.content.map(blockToText).join('\n')
        : '(result not saved)'
      const preview =
        result.length > RESULT_PREVIEW
          ? `${result.slice(0, RESULT_PREVIEW)}\n… (truncated)`
          : result
      lines.push(
        `<details><summary>Tool <code>${e.name}</code>: ${e.result.status}</summary>`,
        '',
        '```json',
        JSON.stringify(redact(e.input), null, 2),
        '```',
        '',
        '```',
        preview,
        '```',
        '',
        '</details>',
        '',
      )
    }
  })
  return lines.join('\n')
}

export function toReadme(events: Conversation.Event[], info: SessionInfo) {
  const { turns, toolCalls } = stats(events)
  const refs = localRefs(events, info.bucket)
  const others = foreignBuckets(events, info.bucket).length
  const title =
    unsign(firstPrompt(events)).split('\n')[0].slice(0, 120) || 'Qurator session'
  return [
    `# ${title}`,
    '',
    `A Qurator session saved ${info.savedAt.toISOString()} (model \`${info.model}\`): ${turns} prompt(s), ${toolCalls} tool call(s).`,
    '',
    '- `transcript.md`: the conversation, readable',
    `- \`session.json\`: every event, replayable (\`${FORMAT}\`)`,
    '',
    ...(refs.length
      ? ['## Touched in this session', '', ...refs.map((r) => `- \`${refId(r)}\``), '']
      : []),
    ...(others ? [`Also touched ${others} other bucket(s), not named here.`, ''] : []),
  ].join('\n')
}

export function toUserMeta(events: Conversation.Event[], info: SessionInfo) {
  return {
    qurator: {
      format: FORMAT,
      sessionId: sessionId(events),
      savedAt: info.savedAt.toISOString(),
      model: info.model,
      ...stats(events),
      resultsIncluded: info.includeResults,
      references: localRefs(events, info.bucket).map(refId),
      otherBuckets: foreignBuckets(events, info.bucket).length,
    },
  }
}
