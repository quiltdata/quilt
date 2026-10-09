import { describe, expect, it, vi } from 'vitest'

import * as Content from './Content'
import * as Conversation from './Conversation'
import * as SessionPackage from './SessionPackage'
import * as Tool from './Tool'

vi.mock('constants/config', () => ({ default: {} }))

const at = new Date('2026-10-06T12:00:00Z')
const info = {
  model: 'test-model',
  savedAt: at,
  bucket: 'quilt-dev',
  includeResults: true,
}

const msg = (role: 'user' | 'assistant', text: string, extra = {}) =>
  Conversation.Event.Message({
    id: text,
    timestamp: at,
    role,
    content: Content.MessageContentBlock.Text({ text }),
    ...extra,
  })

const tool = (name: string, input: Record<string, any>, result: Tool.Result) =>
  Conversation.Event.ToolUse({
    id: name,
    timestamp: at,
    toolUseId: name,
    name,
    input,
    result,
  })

const events = [
  msg('user', 'What is in Cell Painting?', { id: 'abcdef123' }),
  tool(
    'package_browse',
    { bucket: 'quilt-dev', package_name: 'cell/painting' },
    Tool.succeed(Content.ToolResultContentBlock.Text({ text: 'x'.repeat(3000) })),
  ),
  tool(
    'object_read',
    { uri: 's3://quilt-dev/cell/painting/README.md' },
    Tool.succeed(
      Content.ToolResultContentBlock.Image({ format: 'png', source: 'BYTES' }),
    ),
  ),
  tool('bucket_list', { bucket: 'quilt-dev' }, Tool.succeed()),
  tool('mcp_call', { uri: 's3://other/secret.csv', api_key: 'sk-LIVE' }, Tool.succeed()),
  msg('assistant', 'It holds images.'),
  msg('user', 'discarded prompt', { discarded: true }),
]

describe('components/Assistant/Model/SessionPackage', () => {
  it('lists what tool calls touched, most specific first, once each', () => {
    expect(SessionPackage.references(events).map(SessionPackage.referenceId)).toEqual([
      'quilt+s3://quilt-dev#package=cell/painting',
      's3://quilt-dev/cell/painting/README.md',
      's3://other/secret.csv',
    ])
  })

  it('reads package_browse-style `name` as a package', () => {
    const e = [tool('t', { bucket: 'b', name: 'ns/n', path: '' }, Tool.succeed())]
    expect(SessionPackage.references(e)).toEqual([
      { kind: 'package', bucket: 'b', name: 'ns/n' },
    ])
  })

  it('parses quilt+s3 package URIs', () => {
    const e = [tool('t', { uri: 'quilt+s3://b#package=ns/n@abc&path=x' }, Tool.succeed())]
    expect(SessionPackage.references(e)).toEqual([
      { kind: 'package', bucket: 'b', name: 'ns/n' },
    ])
  })

  it("names the package in the user's namespace, unique per session", () => {
    expect(SessionPackage.defaultName(events, at, 'alice')).toBe(
      'alice/qurator-2026-10-06-what-is-in-cell-painting-abcdef',
    )
    expect(SessionPackage.defaultName([], at, '')).toBe(
      'qurator/qurator-2026-10-06-session',
    )
  })

  it('redacts credential-like tool inputs everywhere', () => {
    expect(SessionPackage.toSessionJson(events, info)).not.toContain('sk-LIVE')
    expect(SessionPackage.toTranscript(events, info)).not.toContain('sk-LIVE')
  })

  it('counts, never names, other buckets', () => {
    expect(SessionPackage.foreignBuckets(events, 'quilt-dev')).toEqual(['other'])
    const readme = SessionPackage.toReadme(events, info)
    expect(readme).not.toContain('secret.csv')
    expect(readme).toContain('1 other bucket(s)')
  })

  it('removes presigned URLs from inputs and results', () => {
    const url = 'https://b.s3.amazonaws.com/k?X-Amz-Signature=abc123&X-Amz-Credential=xyz'
    const e = [
      tool(
        'object_link',
        { bucket: 'b', key: 'k', note: url },
        Tool.succeed(Content.ToolResultContentBlock.Text({ text: `link: ${url}` })),
      ),
    ]
    const info2 = { ...info, includeResults: true }
    expect(SessionPackage.toSessionJson(e, info2)).not.toContain('abc123')
    expect(SessionPackage.toTranscript(e, info2)).not.toContain('abc123')
  })

  it('removes SigV2 presigned URLs, the Platform server default in most regions', () => {
    const url =
      'https://b.s3.amazonaws.com/k?AWSAccessKeyId=ASIAEXAMPLE&Signature=sig%3D&x-amz-security-token=TOKEN&Expires=1'
    const e = [
      tool(
        'platform__object_read',
        { bucket: 'b', key: 'k' },
        Tool.succeed(Content.ToolResultContentBlock.Text({ text: url })),
      ),
    ]
    const out = SessionPackage.toSessionJson(e, { ...info, includeResults: true })
    expect(out).not.toContain('ASIAEXAMPLE')
    expect(out).not.toContain('TOKEN')
  })

  it('flags a call that ran without naming a bucket', () => {
    expect(SessionPackage.unscoped(events)).toBe(false)
    const search = [tool('platform__search_objects', { query: 'csv' }, Tool.succeed())]
    expect(SessionPackage.unscoped(search)).toBe(true)
    // Catalog tools read no data.
    const nav = [tool('navigate', { route: 'search' }, Tool.succeed())]
    expect(SessionPackage.unscoped(nav)).toBe(false)
  })

  it('leaves tool results out when told to', () => {
    const off = { ...info, includeResults: false }
    expect(SessionPackage.toSessionJson(events, off)).not.toContain('x'.repeat(100))
    expect(SessionPackage.toTranscript(events, off)).not.toContain('x'.repeat(100))
  })

  it('writes a replayable session.json without bytes or discarded events', () => {
    const json = JSON.parse(SessionPackage.toSessionJson(events, info))
    expect(json.format).toBe(SessionPackage.FORMAT)
    expect(json.events).toHaveLength(6)
    expect(json.sessionId).toBe('abcdef123')
    expect(json.events[2].result.content).toEqual([
      { type: 'image', format: 'png', omitted: true },
    ])
    expect(JSON.stringify(json)).not.toContain('BYTES')
    expect(JSON.stringify(json)).not.toContain('discarded prompt')
  })

  it('truncates long tool results in the transcript only', () => {
    const t = SessionPackage.toTranscript(events, info)
    expect(t).toContain('… (truncated)')
    expect(t).not.toContain('x'.repeat(2001))
    expect(SessionPackage.toSessionJson(events, info)).toContain('x'.repeat(3000))
  })

  it('records counts and references in user metadata', () => {
    expect(SessionPackage.toUserMeta(events, info).qurator).toMatchObject({
      format: SessionPackage.FORMAT,
      turns: 1,
      toolCalls: 4,
      sessionId: 'abcdef123',
      otherBuckets: 1,
      references: [
        'quilt+s3://quilt-dev#package=cell/painting',
        's3://quilt-dev/cell/painting/README.md',
      ],
    })
  })

  it('titles the README with the first prompt', () => {
    expect(SessionPackage.toReadme(events, info)).toMatch(/^# What is in Cell Painting\?/)
  })
})
