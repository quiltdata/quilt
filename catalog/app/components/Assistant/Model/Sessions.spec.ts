import * as Eff from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as Content from './Content'
import * as Conversation from './Conversation'
import * as Sessions from './Sessions'

vi.mock('constants/config', () => ({ default: {} }))

const at = new Date('2026-10-06T12:00:00.000Z')

const message = (id: string, role: 'user' | 'assistant', content: any) =>
  Conversation.Event.Message({ id, timestamp: at, role, content })

const toolUse = (id: string, content: Content.ToolResultContentBlock[]) =>
  Conversation.Event.ToolUse({
    id,
    timestamp: at,
    toolUseId: `tu-${id}`,
    name: 'search',
    input: { q: 'cells' },
    result: { status: 'success', content },
  })

const text = (t: string) => Content.MessageContentBlock.Text({ text: t })

describe('components/Assistant/Model/Sessions', () => {
  afterEach(() => window.localStorage.clear())

  describe('encode / decode', () => {
    it('round-trips text messages and JSON / text tool results', () => {
      const events = [
        message('1', 'user', text('find my packages')),
        toolUse('2', [
          Content.ToolResultContentBlock.Json({ json: { hits: 3 } }),
          Content.ToolResultContentBlock.Text({ text: 'done' }),
        ]),
        message('3', 'assistant', text('You have 3.')),
      ]
      const restored = Sessions.decode(
        JSON.parse(JSON.stringify(Sessions.encode(events))),
      )
      expect(restored).toEqual(events)
    })

    it('replaces images and documents with a placeholder', () => {
      const env = Sessions.encode([
        message(
          '1',
          'assistant',
          Content.MessageContentBlock.Image({ format: 'png', source: 'AAAA' }),
        ),
        toolUse('2', [
          Content.ToolResultContentBlock.Document({
            format: 'csv',
            name: 'a.csv',
            source: 'x,y',
          }),
        ]),
      ])
      const serialized = JSON.stringify(env)
      expect(serialized).not.toContain('AAAA')
      expect(serialized).not.toContain('x,y')
      expect(serialized).toContain('[image (png) not retained')
      expect(serialized).toContain('[document a.csv not retained')
    })

    it('drops discarded events', () => {
      const kept = message('1', 'user', text('keep'))
      const gone = { ...message('2', 'user', text('gone')), discarded: true }
      expect(Sessions.encode([kept, gone]).events.map((e) => e.id)).toEqual(['1'])
    })

    it('refuses an envelope it cannot read', () => {
      expect(Sessions.decode({ v: 2, events: [] })).toBeNull()
      expect(Sessions.decode({ v: 1, events: [{ _tag: 'Nope' }] })).toBeNull()
      expect(Sessions.decode(null)).toBeNull()
    })
  })

  describe('titleOf', () => {
    it('takes the first line of the first user message, truncated', () => {
      const long = 'x'.repeat(200)
      expect(
        Sessions.titleOf([message('1', 'user', text(`${long}\nmore`))]),
      ).toHaveLength(Sessions.TITLE_LENGTH)
      expect(Sessions.titleOf([])).toBe('Untitled session')
    })
  })

  describe('local store', () => {
    const session = (id: string): Sessions.Session => ({
      id,
      title: id,
      updatedAt: at.toISOString(),
      envelope: Sessions.encode([message(id, 'user', text(id))]),
    })

    it('keeps each account to its own sessions', () => {
      Sessions.save('alice', session('a1'))
      expect(Sessions.list('alice').map((s) => s.id)).toEqual(['a1'])
      expect(Sessions.list('bob')).toEqual([])
    })

    it('puts the latest save first and caps the list', () => {
      for (let i = 0; i < Sessions.MAX_SESSIONS + 2; i += 1)
        Sessions.save('u', session(`s${i}`))
      Sessions.save('u', session('s5'))
      const ids = Sessions.list('u').map((s) => s.id)
      expect(ids).toHaveLength(Sessions.MAX_SESSIONS)
      expect(ids[0]).toBe('s5')
      expect(ids.filter((id) => id === 's5')).toHaveLength(1)
    })

    it('turning sessions off deletes them', () => {
      Sessions.setEnabled('u', true)
      Sessions.save('u', session('s1'))
      expect(Sessions.isEnabled('u')).toBe(true)
      Sessions.setEnabled('u', false)
      expect(Sessions.isEnabled('u')).toBe(false)
      expect(Sessions.list('u')).toEqual([])
    })

    it('removes one session', () => {
      Sessions.save('u', session('s1'))
      Sessions.save('u', session('s2'))
      Sessions.remove('u', 's1')
      expect(Sessions.list('u').map((s) => s.id)).toEqual(['s2'])
    })
  })

  describe('Conversation Restore', () => {
    it('replaces the events of an idle conversation', async () => {
      const def = Eff.Effect.runSync(Conversation.ConversationActor)
      const idle = Eff.Effect.runSync(Conversation.init)
      const events = [message('1', 'user', text('hi'))]
      const next = Eff.Effect.runSync(
        def(idle, Conversation.Action.Restore({ events }), () =>
          Eff.Effect.succeed(true),
        ) as Eff.Effect.Effect<Conversation.State>,
      )
      expect(next._tag).toBe('Idle')
      expect(next.events).toBe(events)
    })
  })
})
