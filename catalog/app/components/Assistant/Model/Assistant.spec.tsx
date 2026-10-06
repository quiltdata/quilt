import * as Eff from 'effect'
import * as React from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))

const HAIKU = 'us.anthropic.claude-haiku-4-5-20251001-v1:0'
const OPUS = 'us.anthropic.claude-opus-4-5-20251101-v1:0'
const KEY = 'QUILT_BEDROCK_MODEL_ID'

const governed = vi.hoisted(() => ({
  current: null as any,
  settled: true,
  failed: false,
}))

vi.mock('./ModelChoice', async (importActual) => ({
  ...(await importActual<typeof import('./ModelChoice')>()),
  useGoverned: () => ({
    governed: governed.current,
    settled: governed.settled,
    failed: governed.failed,
  }),
}))

const mcpRead = vi.hoisted(() => ({ current: (): any => ({ mcpServers: [] }) }))

vi.mock('utils/GraphQL', async (importActual) => ({
  ...(await importActual<typeof import('utils/GraphQL')>()),
  useQueryS: () => mcpRead.current(),
}))

vi.mock('react-redux', async (importActual) => ({
  ...(await importActual<typeof import('react-redux')>()),
  useDispatch: () => vi.fn(),
}))

import { useModelIdOverride, useRegisteredConnectorConfigs } from './Assistant'

describe('components/Assistant/Model/Assistant useRegisteredConnectorConfigs', () => {
  afterEach(cleanup)

  const configs = () => {
    const box: { current: ReturnType<typeof useRegisteredConnectorConfigs> | null } = {
      current: null,
    }
    function Harness() {
      box.current = useRegisteredConnectorConfigs()
      return null
    }
    render(<Harness />)
    return box.current!
  }

  it('relays each enabled server as optional, third-party unless trusted', () => {
    mcpRead.current = () => ({
      mcpServers: [
        { slug: 'gpu', title: 'GPU', hint: null, trusted: false },
        { slug: 'docs', title: 'Docs', hint: 'Docs search', trusted: true },
      ],
    })
    expect(
      configs().map(({ id, optional, thirdParty, hint }) => ({
        id,
        optional,
        thirdParty,
        hint,
      })),
    ).toEqual([
      { id: 'gpu', optional: true, thirdParty: true, hint: undefined },
      { id: 'docs', optional: true, thirdParty: false, hint: 'Docs search' },
    ])
  })

  it('degrades to no servers when the read fails', () => {
    mcpRead.current = () => {
      throw new Error('Cannot query field "mcpServers" on type "Query".')
    }
    expect(configs()).toEqual([])
  })
})

function setup() {
  const box: { current: ReturnType<typeof useModelIdOverride> | null } = { current: null }
  function Harness() {
    box.current = useModelIdOverride()
    return null
  }
  const { rerender } = render(<Harness />)
  return {
    sent: () => Eff.Effect.runPromise(box.current![0]),
    model: () => box.current![2],
    rerender: () => rerender(<Harness />),
  }
}

describe('components/Assistant/Model/Assistant useModelIdOverride', () => {
  beforeEach(() => {
    localStorage.clear()
    governed.current = null
    governed.settled = true
    governed.failed = false
  })
  afterEach(cleanup)

  it('ungoverned, sends and keeps a stored override, as before', async () => {
    localStorage.setItem(KEY, 'moonshot.kimi-k3-v1:0')
    const h = setup()
    expect(await h.sent()).toBe('moonshot.kimi-k3-v1:0')
    expect(localStorage.getItem(KEY)).toBe('moonshot.kimi-k3-v1:0')
  })

  it('governed, never sends a stored non-member and drops it from storage', async () => {
    localStorage.setItem(KEY, 'moonshot.kimi-k3-v1:0')
    governed.current = { allowlist: [HAIKU, OPUS], default: OPUS }
    const h = setup()
    expect(await h.sent()).toBe(OPUS)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('drops a stored non-member once the governed set arrives', async () => {
    localStorage.setItem(KEY, 'moonshot.kimi-k3-v1:0')
    const h = setup()
    governed.current = { allowlist: [HAIKU, OPUS], default: OPUS }
    h.rerender()
    expect(await h.sent()).toBe(OPUS)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('governed, a picked model is sent and remembered', async () => {
    governed.current = { allowlist: [HAIKU, OPUS], default: OPUS }
    const h = setup()
    act(() => h.model().select(HAIKU))
    expect(await h.sent()).toBe(HAIKU)
    expect(h.model().current).toBe(HAIKU)
    expect(localStorage.getItem(KEY)).toBe(HAIKU)
  })

  it('holds a turn until the governed read settles, then sends the default', async () => {
    localStorage.setItem(KEY, 'moonshot.kimi-k3-v1:0')
    governed.settled = false
    const h = setup()
    let sent: string | undefined
    h.sent().then((id) => {
      sent = id
    })
    await new Promise((r) => setTimeout(r, 10))
    expect(sent).toBeUndefined()
    governed.current = { allowlist: [HAIKU, OPUS], default: OPUS }
    governed.settled = true
    h.rerender()
    await new Promise((r) => setTimeout(r, 0))
    expect(sent).toBe(OPUS)
  })

  it('after a failed read, sends the stack default and keeps the stored model', async () => {
    localStorage.setItem(KEY, 'moonshot.kimi-k3-v1:0')
    governed.failed = true
    const h = setup()
    expect(await h.sent()).toBe('us.anthropic.claude-sonnet-4-5-20250929-v1:0')
    expect(localStorage.getItem(KEY)).toBe('moonshot.kimi-k3-v1:0')
  })

  it('after a failed read, shows the model it sends', async () => {
    localStorage.setItem(KEY, 'moonshot.kimi-k3-v1:0')
    governed.failed = true
    const h = setup()
    expect(h.model().current).toBe(await h.sent())
  })

  it('restores the stored model once a read succeeds ungoverned', async () => {
    localStorage.setItem(KEY, 'moonshot.kimi-k3-v1:0')
    governed.failed = true
    const h = setup()
    governed.failed = false
    h.rerender()
    expect(await h.sent()).toBe('moonshot.kimi-k3-v1:0')
  })
})
