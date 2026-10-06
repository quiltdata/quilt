import * as Eff from 'effect'
import { act, renderHook } from '@testing-library/react-hooks'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))

const stub = vi.hoisted(() => ({
  saves: [] as any[],
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
      return {
        quratorSessionSave: {
          __typename: 'QuratorSession',
          id: vars.input.id ?? 'NEW',
          version: 8,
        },
      }
    }
    return {}
  },
}))

vi.mock('urql', async (importActual) => ({
  ...(await importActual<typeof import('urql')>()),
  useClient: () => ({
    query: () => ({
      toPromise: async () => ({
        data: { me: { name: 'u', quratorSession: stub.opened } },
      }),
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
  })
  afterEach(() => vi.useRealTimers())

  it('saves a reopened session under its id and version, not as a new one', async () => {
    const restored = [ask('1', 'find my packages')]
    stub.opened = { id: 'S', version: 7, events: Sessions.encode(restored) }

    let rerender: (p: { state: Conversation.State }) => void = () => {}
    const dispatch = vi.fn((a: Conversation.Action) => {
      if (a._tag === 'Restore') rerender({ state: idle(a.events, a.sessionId) })
    })
    const hook = renderHook(({ state }) => useSessions(state, dispatch), {
      initialProps: { state: idle([]) },
    })
    rerender = hook.rerender

    await act(() => hook.result.current.open('S'))
    const opened = dispatch.mock.calls[0][0] as Extract<
      Conversation.Action,
      { _tag: 'Restore' }
    >
    hook.rerender({ state: idle([...opened.events, ask('2', 'and more')], 'S') })
    await act(() => vi.advanceTimersByTimeAsync(1000))

    expect(stub.saves).toHaveLength(1)
    expect(stub.saves[0]).toMatchObject({ id: 'S', baseVersion: 7 })
  })
})
