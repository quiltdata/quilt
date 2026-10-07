import * as Eff from 'effect'
import { act, renderHook } from '@testing-library/react-hooks'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))

const stub = vi.hoisted(() => ({
  saves: [] as any[],
  hang: false,
  readHang: false,
  answerDelete: (() => {}) as (v?: unknown) => void,
  opened: null as any,
}))

const nameOf = (doc: any): string => doc.definitions[0].name.value

vi.mock('utils/GraphQL', async (importActual) => ({
  ...(await importActual<typeof import('utils/GraphQL')>()),
  useQuery: () => ({
    data: {
      me: { name: 'u', quratorSessionsEnabled: true, quratorSessions: [] },
      config: { quratorModels: { sessionsEnabled: true } },
    },
    run: () => {},
  }),
  useMutation: (doc: any) => async (vars: any) => {
    if (nameOf(doc).endsWith('QuratorSessionSave')) {
      stub.saves.push(vars.input)
      if (stub.hang) await new Promise(() => {})
      return {
        quratorSessionSave: {
          __typename: 'QuratorSession',
          id: vars.input.id ?? 'NEW',
          version: 8,
        },
      }
    }
    if (nameOf(doc).endsWith('QuratorSessionDelete')) {
      await new Promise((resolve) => (stub.answerDelete = resolve))
      return { quratorSessionDelete: { __typename: 'Ok' } }
    }
    return {}
  },
}))

vi.mock('urql', async (importActual) => ({
  ...(await importActual<typeof import('urql')>()),
  useClient: () => ({
    query: () => ({
      toPromise: async () => {
        if (stub.readHang) await new Promise(() => {})
        return { data: { me: { name: 'u', quratorSession: stub.opened } } }
      },
    }),
  }),
}))

import * as Content from './Content'
import * as Conversation from './Conversation'
import * as Sessions from './Sessions'
import { useSessions } from './Assistant'

const at = new Date('2026-10-06T12:00:00.000Z')
const ask = (id: string, t: string) =>
  Conversation.Event.Message({
    id,
    timestamp: at,
    role: 'user',
    content: Content.MessageContentBlock.Text({ text: t }),
  })

const idle = (events: Conversation.Event[], sessionId?: string) =>
  Conversation.State.Idle({
    events,
    timestamp: at,
    sessionId: Eff.Option.fromNullable(sessionId),
    error: Eff.Option.none(),
  })

describe('components/Assistant/Model/Assistant useSessions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    stub.saves = []
    stub.hang = false
    stub.readHang = false
  })
  afterEach(() => vi.useRealTimers())

  it('saves a reopened session under its id and version, not as a new one', async () => {
    const restored = [ask('1', 'find my packages')]
    stub.opened = { id: 'S', version: 7, events: Sessions.encode(restored) }

    interface Props {
      state: Conversation.State
    }
    let rerender: (p: Props) => void = () => {}
    const dispatch = vi.fn((a: Conversation.Action) => {
      if (a._tag === 'Restore') rerender({ state: idle(a.events, a.sessionId) })
    })
    const hook = renderHook<Props, ReturnType<typeof useSessions>>(
      ({ state }) => useSessions(state, dispatch, 'm'),
      { initialProps: { state: idle([]) } },
    )
    rerender = hook.rerender

    await act(async () => {
      await hook.result.current.open('S')
    })
    const opened = dispatch.mock.calls[0][0] as Extract<
      Conversation.Action,
      { _tag: 'Restore' }
    >
    hook.rerender({ state: idle([...opened.events, ask('2', 'and more')], 'S') })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })

    expect(stub.saves).toHaveLength(1)
    expect(stub.saves[0]).toMatchObject({ id: 'S', baseVersion: 7 })
  })

  it('checkpoints the conversation as a package when the panel closes', async () => {
    const state = idle([ask('1', 'find my packages')])
    const hook = renderHook(
      ({ visible }: { visible: boolean }) => useSessions(state, vi.fn(), 'm', visible),
      { initialProps: { visible: true } },
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(stub.saves).toHaveLength(1)
    expect(stub.saves[0].checkpoint).toBeNull()

    hook.rerender({ visible: false })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(stub.saves).toHaveLength(2)
    expect(stub.saves[1]).toMatchObject({
      id: 'NEW',
      checkpoint: {
        readme: expect.stringContaining('# find my packages'),
        transcript: expect.stringContaining('find my packages'),
        session: expect.objectContaining({ model: 'm' }),
      },
    })
  })

  it('checkpoints the conversation left by New session', async () => {
    const hook = renderHook(
      ({ state }: { state: Conversation.State }) => useSessions(state, vi.fn(), 'm'),
      { initialProps: { state: idle([ask('1', 'find my packages')]) } },
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    hook.rerender({ state: idle([]) })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(stub.saves).toHaveLength(2)
    expect(stub.saves[1].checkpoint).toMatchObject({ readme: expect.any(String) })
  })

  it('saves without a checkpoint past 2 MiB', async () => {
    const state = idle([ask('1', 'x'.repeat(1100 * 1024))])
    const hook = renderHook(
      ({ visible }: { visible: boolean }) => useSessions(state, vi.fn(), 'm', visible),
      { initialProps: { visible: true } },
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    hook.rerender({ visible: false })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(stub.saves).toHaveLength(2)
    expect(stub.saves[1]).toMatchObject({ id: 'NEW', checkpoint: null })
    expect(hook.result.current.notice).toBe(null)

    // Not tried again until the conversation changes.
    hook.rerender({ visible: true })
    hook.rerender({ visible: false })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(stub.saves).toHaveLength(2)
  })

  it('gives up on a session read that hangs, and unlocks the chat', async () => {
    stub.readHang = true
    stub.opened = { id: 'S', version: 7, events: Sessions.encode([ask('9', 'x')]) }
    const dispatch = vi.fn()
    const hook = renderHook(
      ({ state }: { state: Conversation.State }) => useSessions(state, dispatch, 'm'),
      { initialProps: { state: idle([]) } },
    )
    let opening: Promise<void> = Promise.resolve()
    act(() => {
      opening = hook.result.current.open('S')
    })
    expect(hook.result.current.switching).toBe(true)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
      await opening
    })
    expect(dispatch).not.toHaveBeenCalled()
    expect(hook.result.current.switching).toBe(false)
    expect(hook.result.current.notice).toBe("That session couldn't be opened")
  })

  it('does not open past a save that hangs, and unlocks the chat', async () => {
    stub.hang = true
    stub.opened = { id: 'S', version: 7, events: Sessions.encode([ask('9', 'x')]) }
    const dispatch = vi.fn()
    const hook = renderHook(
      ({ state }: { state: Conversation.State }) => useSessions(state, dispatch, 'm'),
      { initialProps: { state: idle([ask('1', 'unsaved')]) } },
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(stub.saves).toHaveLength(1)
    let opening: Promise<void> = Promise.resolve()
    act(() => {
      opening = hook.result.current.open('S')
    })
    expect(hook.result.current.switching).toBe(true)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
      await opening
    })
    expect(dispatch).not.toHaveBeenCalled()
    expect(hook.result.current.switching).toBe(false)
    expect(hook.result.current.notice).toBe("That session couldn't be opened")
  })

  it('keeps a session held past a slow delete, so a late delete is not undone', async () => {
    const restored = [ask('1', 'secret')]
    stub.opened = { id: 'S', version: 7, events: Sessions.encode(restored) }
    interface Props {
      state: Conversation.State
    }
    let rerender: (p: Props) => void = () => {}
    const dispatch = vi.fn((a: Conversation.Action) => {
      if (a._tag === 'Restore') rerender({ state: idle(a.events, a.sessionId) })
    })
    const hook = renderHook<Props, ReturnType<typeof useSessions>>(
      ({ state }) => useSessions(state, dispatch, 'm'),
      { initialProps: { state: idle([]) } },
    )
    rerender = hook.rerender
    await act(async () => {
      await hook.result.current.open('S')
    })
    const events = (dispatch.mock.calls[0][0] as any).events as Conversation.Event[]

    let removing: Promise<void> = Promise.resolve()
    act(() => {
      removing = hook.result.current.remove('S')
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
      await removing
    })
    expect(hook.result.current.switching).toBe(false)
    hook.rerender({ state: idle([...events, ask('2', 'more')], 'S') })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    expect(stub.saves).toEqual([])

    await act(async () => {
      stub.answerDelete()
      await vi.advanceTimersByTimeAsync(0)
    })
    hook.rerender({ state: idle([...events, ask('2', 'more'), ask('3', 'again')], 'S') })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    expect(stub.saves).toEqual([])
    expect(hook.result.current.notice).toBe(
      'This session was deleted, so it is no longer kept — start a new one',
    )
  })
})
