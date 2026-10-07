import * as Eff from 'effect'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

    it('makes every string storable: no NUL, no lone surrogate', () => {
      const env = Sessions.encode([
        toolUse('1', [
          Content.ToolResultContentBlock.Text({ text: 'a\u0000b\uD800c😀' }),
          Content.ToolResultContentBlock.Json({ json: { 'k\u0000': ['\uDC00'] } }),
        ]),
      ])
      expect(JSON.stringify(env)).not.toMatch(/\\u0000|\\ud8|\\udc/i)
      const [textBlock, json] = (env.events[0] as any).result.content
      expect(textBlock.text).toBe('ab�c😀')
      expect(json.json).toEqual({ k: ['�'] })
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
      const bad = Sessions.encode([message('1', 'user', text('hi'))])
      expect(
        Sessions.decode({ ...bad, events: [{ ...bad.events[0], timestamp: 'nope' }] }),
      ).toBeNull()
    })
  })

  describe('titleOf', () => {
    it('takes the first line of the first user message, truncated', () => {
      const long = 'x'.repeat(200)
      expect(
        Sessions.titleOf([message('1', 'user', text(`${long}\nmore`))]),
      ).toHaveLength(Sessions.TITLE_LENGTH)
      expect(Sessions.titleOf([])).toBe('Untitled session')
      const astral = Sessions.titleOf([
        message('1', 'user', text(`${'x'.repeat(78)}😀😀😀`)),
      ])
      expect(astral).toBe(`${'x'.repeat(78)}😀…`)
    })

    it('skips a discarded first message', () => {
      const gone = { ...message('1', 'user', text('gone')), discarded: true }
      expect(Sessions.titleOf([gone, message('2', 'user', text('kept'))])).toBe('kept')
    })
  })

  describe('outcomeOf', () => {
    it('reads the registry error names', () => {
      const invalid = (name: string) =>
        Sessions.outcomeOf({ __typename: 'InvalidInput', errors: [{ name }] })._tag
      expect(invalid('Conflict')).toBe('Conflict')
      expect(invalid('NotFound')).toBe('NotFound')
      expect(invalid('TooLarge')).toBe('TooLarge')
      expect(invalid('BadEnvelope')).toBe('BadEnvelope')
      expect(invalid('Whatever')).toBe('Failed')
      expect(
        Sessions.outcomeOf({ __typename: 'OperationError', name: 'Disabled' })._tag,
      ).toBe('Disabled')
      expect(
        Sessions.outcomeOf({
          __typename: 'InvalidInput',
          errors: [{ name: 'TooLarge', path: 'input.checkpoint' }],
        })._tag,
      ).toBe('CheckpointTooLarge')
    })

    it('counts a save as packaged only once the package is revised past it', () => {
      const session = (revisedAt: Date | null) =>
        Sessions.outcomeOf({
          __typename: 'QuratorSession',
          id: 's',
          version: 2,
          updatedAt: at,
          package: revisedAt && { revisedAt },
        })
      expect(session(new Date(at.getTime() + 1))).toMatchObject({ packaged: true })
      expect(session(new Date(at.getTime() - 1))).toMatchObject({ packaged: false })
      expect(session(null)).toMatchObject({ packaged: false })
    })
  })

  describe('createSaveQueue', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    type Send = (r: Sessions.SaveRequest<string>) => Promise<Sessions.SaveOutcome>

    function setup(send: Send) {
      const created: { head: string; basis: string | null; id: string }[] = []
      const stopped: [string, Sessions.Stop][] = []
      const sendSpy = vi.fn(send)
      const queue = Sessions.createSaveQueue<string>({
        send: sendSpy,
        onCreated: (c) => created.push(c),
        onStopped: (h, r) => stopped.push([h, r]),
        delayMs: 1000,
      })
      return { queue, send: sendSpy, created, stopped }
    }

    const saved = (
      id: string,
      version: number,
      packaged = true,
    ): Sessions.SaveOutcome => ({
      _tag: 'Saved',
      id,
      version,
      packaged,
    })

    it('debounces, keeps one save in flight, and chains the version it returned', async () => {
      let resolve: (o: Sessions.SaveOutcome) => void = () => {}
      const { queue, send, created } = setup(() => new Promise((r) => (resolve = r)))
      queue.change('h', 'a')
      queue.change('h', 'ab')
      await vi.advanceTimersByTimeAsync(1000)
      expect(send.mock.calls.map(([r]) => r)).toEqual([
        { id: null, baseVersion: null, events: 'ab' },
      ])
      queue.change('h', 'abc')
      queue.change('h', 'abcd')
      await vi.advanceTimersByTimeAsync(1000)
      expect(send).toHaveBeenCalledTimes(1)
      resolve(saved('s1', 1))
      await vi.advanceTimersByTimeAsync(0)
      expect(created).toEqual([{ head: 'h', basis: null, id: 's1' }])
      expect(send.mock.calls[1][0]).toEqual({ id: 's1', baseVersion: 1, events: 'abcd' })
    })

    it.each(['Conflict', 'NotFound'] as const)(
      'saves the conversation as a new session on %s',
      async (tag) => {
        const outcomes: Sessions.SaveOutcome[] = [{ _tag: tag }, saved('fork', 1)]
        const { queue, send, created } = setup(async () => outcomes.shift()!)
        queue.adopt('h', 'old', 3, 'a')
        queue.change('h', 'ab')
        await vi.advanceTimersByTimeAsync(1000)
        expect(send.mock.calls.map(([r]) => r)).toEqual([
          { id: 'old', baseVersion: 3, events: 'ab' },
          { id: null, baseVersion: null, events: 'ab' },
        ])
        expect(created).toEqual([{ head: 'h', basis: 'old', id: 'fork' }])
      },
    )

    it('never creates an empty session, but empties a saved one', async () => {
      const send = vi.fn(async (r: Sessions.SaveRequest<string>) => saved(r.id ?? 'n', 2))
      const queue = Sessions.createSaveQueue<string>({
        send,
        onCreated: () => {},
        onStopped: () => {},
        isEmpty: (e) => e === 'none',
      })
      queue.change('h', 'a')
      queue.change('h', 'none')
      await vi.advanceTimersByTimeAsync(1000)
      expect(send).not.toHaveBeenCalled()
      queue.adopt('k', 'S', 1, 'x')
      queue.change('k', 'none')
      await vi.advanceTimersByTimeAsync(1000)
      expect(send.mock.calls[0][0]).toEqual({ id: 'S', baseVersion: 1, events: 'none' })
    })

    it('does not retry a failed create', async () => {
      const { queue, send } = setup(async () => ({ _tag: 'Failed' }))
      queue.change('h', 'a')
      await vi.advanceTimersByTimeAsync(10000)
      expect(send).toHaveBeenCalledTimes(1)
    })

    it('drops a fork whose conflict lands after a pause, even through a later flush', async () => {
      let resolve: (o: Sessions.SaveOutcome) => void = () => {}
      const { queue, send } = setup((r) =>
        r.id === 'A'
          ? new Promise((res) => (resolve = res))
          : Promise.resolve(saved('F', 1)),
      )
      queue.adopt('a', 'A', 1, 'x')
      queue.change('a', 'xy')
      await vi.advanceTimersByTimeAsync(1000)
      queue.change('b', 'z')
      queue.pause()
      resolve({ _tag: 'Conflict' })
      await vi.advanceTimersByTimeAsync(0)
      queue.resume()
      await queue.flush()
      expect(send).toHaveBeenCalledTimes(1)
    })

    it('does not loop when a create is answered NotFound', async () => {
      const { queue, send } = setup(async () => ({ _tag: 'NotFound' }))
      queue.change('h', 'a')
      await vi.advanceTimersByTimeAsync(10000)
      expect(send).toHaveBeenCalledTimes(1)
    })

    it('stops saving a session that is too long', async () => {
      const { queue, send, stopped } = setup(async () => ({ _tag: 'TooLarge' }))
      queue.change('h', 'a')
      await vi.advanceTimersByTimeAsync(1000)
      queue.change('h', 'ab')
      await vi.advanceTimersByTimeAsync(1000)
      expect(send).toHaveBeenCalledTimes(1)
      expect(stopped).toEqual([['h', 'TooLarge']])
    })

    it('does not resave what was just opened', async () => {
      const { queue, send } = setup(async () => saved('s', 2))
      queue.adopt('h', 's', 1, 'a')
      queue.change('h', 'a')
      await vi.advanceTimersByTimeAsync(1000)
      expect(send).not.toHaveBeenCalled()
    })

    it('sends a pending save under its own id before opening another', async () => {
      const { queue, send } = setup(async (r) => saved(r.id ?? 'new', 1))
      queue.adopt('a', 'A', 4, 'x')
      queue.change('a', 'xy')
      queue.adopt('b', 'B', 7, 'z')
      await vi.advanceTimersByTimeAsync(0)
      expect(send.mock.calls.map(([r]) => r)).toEqual([
        { id: 'A', baseVersion: 4, events: 'xy', checkpoint: true },
      ])
    })

    describe('checkpoints', () => {
      const checkpoints = (send: ReturnType<typeof setup>['send']) =>
        send.mock.calls.map(([r]) => r).filter((r) => r.checkpoint)

      it('leaves ordinary saves draft-only', async () => {
        const { queue, send } = setup(async () => saved('s', 1))
        queue.change('h', 'a')
        await vi.advanceTimersByTimeAsync(1000)
        queue.change('h', 'ab')
        await vi.advanceTimersByTimeAsync(1000)
        expect(send).toHaveBeenCalledTimes(2)
        expect(checkpoints(send)).toEqual([])
      })

      it('cuts one 60 s after the last change, and no more while nothing changes', async () => {
        const { queue, send } = setup(async () => saved('s', 1))
        queue.change('h', 'a')
        await vi.advanceTimersByTimeAsync(30_000)
        queue.change('h', 'ab')
        await vi.advanceTimersByTimeAsync(59_000)
        expect(checkpoints(send)).toEqual([])
        await vi.advanceTimersByTimeAsync(1000)
        expect(checkpoints(send)).toEqual([
          { id: 's', baseVersion: 1, events: 'ab', checkpoint: true },
        ])
        await vi.advanceTimersByTimeAsync(600_000)
        expect(send).toHaveBeenCalledTimes(3)
      })

      it('cuts one every 5 min while changes keep coming', async () => {
        const { queue, send } = setup(async () => saved('s', 1))
        for (let i = 1; i <= 10; i++) {
          queue.change('h', 'a'.repeat(i))
          await vi.advanceTimersByTimeAsync(30_000)
        }
        expect(checkpoints(send).map((r) => r.events)).toEqual(['a'.repeat(10)])
      })

      it('cuts one for the conversation left by switching or starting another', async () => {
        const { queue, send } = setup(async (r) => saved(r.id ?? 'new', 1))
        queue.change('a', 'x')
        await vi.advanceTimersByTimeAsync(1000)
        queue.change('b', 'y')
        await vi.advanceTimersByTimeAsync(0)
        expect(checkpoints(send)).toEqual([
          { id: 'new', baseVersion: 1, events: 'x', checkpoint: true },
        ])
      })

      it('cuts one on demand, once per change', async () => {
        const { queue, send } = setup(async () => saved('s', 1))
        queue.change('h', 'a')
        await vi.advanceTimersByTimeAsync(1000)
        queue.checkpoint()
        await vi.advanceTimersByTimeAsync(0)
        queue.checkpoint()
        await vi.advanceTimersByTimeAsync(0)
        expect(checkpoints(send)).toEqual([
          { id: 's', baseVersion: 1, events: 'a', checkpoint: true },
        ])
      })

      it('cuts one for an opened session whose package lags its draft', async () => {
        const { queue, send } = setup(async () => saved('s', 2))
        queue.adopt('h', 's', 1, 'a', false)
        queue.checkpoint()
        queue.adopt('k', 't', 1, 'b')
        queue.checkpoint()
        await vi.advanceTimersByTimeAsync(0)
        expect(checkpoints(send).map((r) => r.events)).toEqual(['a'])
      })

      it('carries a checkpoint that failed on the retry', async () => {
        const outcomes: Sessions.SaveOutcome[] = [
          saved('s', 1),
          { _tag: 'Failed' },
          saved('s', 2),
        ]
        const { queue, send } = setup(async () => outcomes.shift()!)
        queue.change('h', 'a')
        await vi.advanceTimersByTimeAsync(1000)
        queue.checkpoint()
        await vi.advanceTimersByTimeAsync(5000)
        expect(checkpoints(send)).toEqual([
          { id: 's', baseVersion: 1, events: 'a', checkpoint: true },
          { id: 's', baseVersion: 1, events: 'a', checkpoint: true },
        ])
      })

      it('tries again at the next trigger when the push did not land', async () => {
        const outcomes = [saved('s', 1), saved('s', 2, false), saved('s', 3)]
        const { queue, send } = setup(async () => outcomes.shift()!)
        queue.change('h', 'a')
        await vi.advanceTimersByTimeAsync(1000)
        queue.checkpoint()
        await vi.advanceTimersByTimeAsync(0)
        queue.checkpoint()
        await vi.advanceTimersByTimeAsync(0)
        queue.checkpoint()
        await vi.advanceTimersByTimeAsync(0)
        expect(checkpoints(send).map((r) => r.baseVersion)).toEqual([1, 2])
      })

      it('saves the draft alone when the registry refuses the checkpoint as too large', async () => {
        const outcomes = [
          saved('s', 1),
          { _tag: 'CheckpointTooLarge' as const },
          saved('s', 2),
        ]
        const { queue, send, stopped } = setup(async () => outcomes.shift()!)
        queue.change('h', 'a')
        await vi.advanceTimersByTimeAsync(1000)
        queue.checkpoint()
        await vi.advanceTimersByTimeAsync(0)
        queue.checkpoint()
        await vi.advanceTimersByTimeAsync(0)
        expect(send.mock.calls.map(([r]) => r)).toEqual([
          { id: null, baseVersion: null, events: 'a' },
          { id: 's', baseVersion: 1, events: 'a', checkpoint: true },
          { id: 's', baseVersion: 1, events: 'a' },
        ])
        expect(stopped).toEqual([])
      })

      it('sends one asked for while held once a delete fails', async () => {
        const { queue, send } = setup(async () => saved('s', 1))
        queue.change('h', 'a')
        await vi.advanceTimersByTimeAsync(1000)
        queue.hold('s')
        queue.checkpoint()
        await vi.advanceTimersByTimeAsync(0)
        expect(checkpoints(send)).toEqual([])
        queue.release('s', false)
        await vi.advanceTimersByTimeAsync(1000)
        expect(checkpoints(send)).toEqual([
          { id: 's', baseVersion: 1, events: 'a', checkpoint: true },
        ])
      })

      it('sends none while paused', async () => {
        const { queue, send } = setup(async () => saved('s', 1))
        queue.change('h', 'a')
        await vi.advanceTimersByTimeAsync(1000)
        queue.pause()
        queue.checkpoint()
        await vi.advanceTimersByTimeAsync(600_000)
        expect(send).toHaveBeenCalledTimes(1)
      })
    })

    describe('checkpointOf', () => {
      it('renders the package files', () => {
        const c = Sessions.checkpointOf([message('1', 'user', text('hi'))], 'm', at)
        expect(c?.readme).toContain('# hi')
        expect(c?.session).toMatchObject({ model: 'm', sessionId: '1' })
      })

      it('leaves tool results out when only that fits in 2 MiB', () => {
        const big = Content.ToolResultContentBlock.Text({ text: 'x'.repeat(2560 * 1024) })
        const c = Sessions.checkpointOf(
          [message('1', 'user', text('hi')), toolUse('2', [big])],
          'm',
          at,
        )
        expect(c?.session).toMatchObject({
          events: [{}, { result: { content: [{ type: 'omitted' }] } }],
        })
      })

      it('is dropped past 2 MiB', () => {
        const big = 'x'.repeat(1024 * 1024)
        expect(Sessions.checkpointOf([message('1', 'user', text(big))], 'm', at)).toBe(
          null,
        )
      })
    })

    it('saves nothing of a session while or after it is deleted', async () => {
      const { queue, send } = setup(async (r) => saved(r.id ?? 'F', 1))
      queue.adopt('h', 'S', 1, 'a')
      queue.hold('S')
      queue.change('h', 'ab')
      await vi.advanceTimersByTimeAsync(5000)
      queue.release('S', true)
      queue.change('h', 'abc')
      await queue.flush()
      await vi.advanceTimersByTimeAsync(5000)
      expect(send).not.toHaveBeenCalled()
    })

    it('does not fork a session held for deletion', async () => {
      let resolve: (o: Sessions.SaveOutcome) => void = () => {}
      const { queue, send } = setup((r) =>
        r.id === 'S'
          ? new Promise((res) => (resolve = res))
          : Promise.resolve(saved('F', 1)),
      )
      queue.adopt('h', 'S', 1, 'a')
      queue.change('h', 'ab')
      await vi.advanceTimersByTimeAsync(1000)
      queue.hold('S')
      resolve({ _tag: 'Conflict' })
      await queue.flush()
      expect(send).toHaveBeenCalledTimes(1)
    })

    it('saves to the same session when a delete fails', async () => {
      const { queue, send } = setup(async (r) => saved(r.id ?? 'F', 2))
      queue.adopt('h', 'S', 1, 'a')
      queue.hold('S')
      queue.change('h', 'ab')
      queue.release('S', false)
      await vi.advanceTimersByTimeAsync(1000)
      expect(send.mock.calls[0][0]).toEqual({ id: 'S', baseVersion: 1, events: 'ab' })
    })

    it('sends nothing while paused, not even a fork or what was pending', async () => {
      let resolve: (o: Sessions.SaveOutcome) => void = () => {}
      const { queue, send } = setup((r) =>
        r.id === 'S'
          ? new Promise((res) => (resolve = res))
          : Promise.resolve(saved('F', 1)),
      )
      queue.adopt('h', 'S', 2, 'a')
      queue.change('h', 'ab')
      await vi.advanceTimersByTimeAsync(1000)
      queue.pause()
      queue.change('h', 'abc')
      resolve({ _tag: 'Conflict' })
      await vi.advanceTimersByTimeAsync(10000)
      expect(send).toHaveBeenCalledTimes(1)
      queue.resume()
      await vi.advanceTimersByTimeAsync(1000)
      expect(send).toHaveBeenCalledTimes(1)
      queue.change('h', 'abcd')
      await vi.advanceTimersByTimeAsync(1000)
      expect(send.mock.calls[1][0]).toEqual({
        id: null,
        baseVersion: null,
        events: 'abcd',
      })
    })

    it('sends a retry at once when flushed', async () => {
      const outcomes: Sessions.SaveOutcome[] = [{ _tag: 'Failed' }, saved('s', 1)]
      const { queue, send } = setup(async () => outcomes.shift()!)
      queue.adopt('h', 'S', 1, 'x')
      queue.change('h', 'a')
      await vi.advanceTimersByTimeAsync(1000)
      let settled = false
      queue.flush().then(() => (settled = true))
      await vi.advanceTimersByTimeAsync(0)
      expect(send).toHaveBeenCalledTimes(2)
      expect(settled).toBe(true)
    })

    it('settles a flush only once an earlier conversation’s save is done too', async () => {
      let resolve: (o: Sessions.SaveOutcome) => void = () => {}
      const { queue } = setup((r) =>
        r.id === 'A'
          ? new Promise((res) => (resolve = res))
          : Promise.resolve(saved('B', 1)),
      )
      queue.adopt('a', 'A', 1, 'x')
      queue.change('a', 'xy')
      queue.change('b', 'z')
      let settled = false
      queue.flush().then(() => (settled = true))
      await vi.advanceTimersByTimeAsync(0)
      expect(settled).toBe(false)
      resolve(saved('A', 2))
      await vi.advanceTimersByTimeAsync(0)
      expect(settled).toBe(true)
    })

    it('sends the retry of an update at once when a flush is waiting', async () => {
      let resolve: (o: Sessions.SaveOutcome) => void = () => {}
      const { queue, send } = setup((r) =>
        send.mock.calls.length === 1
          ? new Promise((res) => (resolve = res))
          : Promise.resolve(saved(r.id!, 3)),
      )
      queue.adopt('h', 'S', 1, 'x')
      queue.change('h', 'xy')
      await vi.advanceTimersByTimeAsync(1000)
      let settled = false
      queue.flush().then(() => (settled = true))
      resolve({ _tag: 'Failed' })
      await vi.advanceTimersByTimeAsync(0)
      expect(send).toHaveBeenCalledTimes(2)
      expect(settled).toBe(true)
    })

    it('settles a flush only once the save in flight is done', async () => {
      let resolve: (o: Sessions.SaveOutcome) => void = () => {}
      const { queue } = setup(() => new Promise((r) => (resolve = r)))
      queue.change('h', 'a')
      let settled = false
      queue.flush().then(() => (settled = true))
      await vi.advanceTimersByTimeAsync(0)
      expect(settled).toBe(false)
      resolve(saved('s', 1))
      await vi.advanceTimersByTimeAsync(0)
      expect(settled).toBe(true)
    })

    it('retries a failed save once, then waits for the next change', async () => {
      const { queue, send } = setup(async () => ({ _tag: 'Failed' }))
      queue.adopt('h', 'S', 1, 'x')
      queue.change('h', 'a')
      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(5000)
      await vi.advanceTimersByTimeAsync(50000)
      expect(send).toHaveBeenCalledTimes(2)
      // The idle checkpoint is a send of its own, and a failed one is not retried.
      await vi.advanceTimersByTimeAsync(600_000)
      expect(send).toHaveBeenCalledTimes(3)
      expect(send.mock.calls[2][0].checkpoint).toBe(true)
    })

    it('reports Disabled without retrying, and saves on the next change', async () => {
      const outcomes: Sessions.SaveOutcome[] = [{ _tag: 'Disabled' }, saved('s', 1)]
      const { queue, send, stopped } = setup(async () => outcomes.shift()!)
      queue.change('h', 'a')
      await vi.advanceTimersByTimeAsync(10000)
      expect(stopped).toEqual([['h', 'Disabled']])
      expect(send).toHaveBeenCalledTimes(1)
      queue.change('h', 'ab')
      await vi.advanceTimersByTimeAsync(1000)
      expect(send).toHaveBeenCalledTimes(2)
    })
  })

  describe('Conversation session identity', () => {
    const def = Eff.Effect.runSync(Conversation.ConversationActor)
    const run = (state: Conversation.State, action: Conversation.Action) =>
      Eff.Effect.runSync(
        def(state, action, () => Eff.Effect.succeed(true)) as Eff.Effect.Effect<
          Conversation.State,
          never,
          never
        >,
      )
    const idle = (events: Conversation.Event[], sessionId?: string) =>
      Conversation.State.Idle({
        events,
        timestamp: at,
        sessionId: Eff.Option.fromNullable(sessionId),
        error: Eff.Option.none(),
      })
    const hi = [message('1', 'user', text('hi'))]

    it('Restore opens a session; Clear leaves it', () => {
      const restored = run(
        idle([]),
        Conversation.Action.Restore({ sessionId: 's1', events: hi }),
      )
      expect(restored.events).toBe(hi)
      expect(restored.sessionId).toEqual(Eff.Option.some('s1'))
      const cleared = run(restored, Conversation.Action.Clear())
      expect(cleared.events).toEqual([])
      expect(cleared.sessionId).toEqual(Eff.Option.none())
    })

    it('Saved names the conversation it was made for', () => {
      const next = run(
        idle(hi),
        Conversation.Action.Saved({ sessionId: Eff.Option.none(), head: '1', id: 's1' }),
      )
      expect(next.sessionId).toEqual(Eff.Option.some('s1'))
      const forked = run(
        next,
        Conversation.Action.Saved({
          sessionId: Eff.Option.some('s1'),
          head: '1',
          id: 'f',
        }),
      )
      expect(forked.sessionId).toEqual(Eff.Option.some('f'))
    })

    it('drops a save result for a conversation no longer on screen', () => {
      // A create sent before "New session", landing after the next question.
      const after = run(
        idle([message('2', 'user', text('next'))]),
        Conversation.Action.Saved({ sessionId: Eff.Option.none(), head: '1', id: 'old' }),
      )
      expect(after.sessionId).toEqual(Eff.Option.none())
      // A save of session A, landing after B was opened.
      const opened = run(
        idle(hi, 'B'),
        Conversation.Action.Saved({
          sessionId: Eff.Option.some('A'),
          head: '1',
          id: 'A2',
        }),
      )
      expect(opened.sessionId).toEqual(Eff.Option.some('B'))
    })

    it('applies a save result while the assistant is answering', () => {
      const waiting = Conversation.State.WaitingForAssistant({
        events: hi,
        timestamp: at,
        sessionId: Eff.Option.none(),
        requestFiber: null as any,
      })
      const next = run(
        waiting,
        Conversation.Action.Saved({ sessionId: Eff.Option.none(), head: '1', id: 's1' }),
      )
      expect(next._tag).toBe('WaitingForAssistant')
      expect(next.sessionId).toEqual(Eff.Option.some('s1'))
    })

    it('ignores Restore while a turn is running', () => {
      const waiting = Conversation.State.WaitingForAssistant({
        events: hi,
        timestamp: at,
        sessionId: Eff.Option.none(),
        requestFiber: null as any,
      })
      expect(
        run(waiting, Conversation.Action.Restore({ sessionId: 's', events: [] })),
      ).toBe(waiting)
    })
  })
})
