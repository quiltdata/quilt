import { renderHook } from '@testing-library/react-hooks'
import { describe, expect, it, vi } from 'vitest'

import * as Content from './Content'
import * as Conversation from './Conversation'
import { useSessionSave } from './SessionSave'

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('react-redux', () => ({ useSelector: () => 'user' }))
vi.mock('urql', async () => ({
  ...(await vi.importActual('urql')),
  useClient: () => ({}),
}))
vi.mock('containers/Bucket/PackageDialog/Uploads', () => ({
  useUploads: () => ({}),
}))
// A lock that never resolves unless paused, as the real hook reads a paused query.
vi.mock('utils/PackageLock', () => ({
  useLockStatus: (_b: string, _n: string, pause: boolean) =>
    pause ? 'unlocked' : 'loading',
}))
vi.mock('utils/GraphQL', async () => ({
  ...(await vi.importActual('utils/GraphQL')),
  useMutation: () => vi.fn(),
  useQuery: (query: unknown, vars: { bucket?: string }) =>
    vars && 'bucket' in vars
      ? { data: { package: null } }
      : { data: { buckets: [{ name: 'b', relevanceScore: 1 }] } },
}))

const event = Conversation.Event.Message({
  id: 'm1',
  timestamp: new Date('2026-10-06T12:00:00Z'),
  role: 'user',
  content: Content.MessageContentBlock.Text({ text: 'hello' }),
})

describe('components/Assistant/Model/SessionSave', () => {
  it('can save to a new name without waiting on its lock', () => {
    const api = { busy: false, state: { events: [event] } } as never
    const { result } = renderHook(() => useSessionSave(api))
    expect(result.current.bucket).toBe('b')
    expect(result.current.blocked).toBeNull()
  })
})
