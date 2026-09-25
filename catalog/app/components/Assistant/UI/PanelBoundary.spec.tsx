import * as React from 'react'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

import { WithAssistantUI } from './UI'

// Renders the real panel host under an app-level Suspense: what must not happen
// is the fallback showing, since in app.tsx that one replaces the whole page.
// UI.spec mocks the chat into a no-op, so it cannot cover this.

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))

const useAssistantAPI = vi.fn()
vi.mock('../Model', () => ({
  useAssistantAPI: () => useAssistantAPI(),
  Conversation: {
    Action: { Clear: () => ({ _tag: 'Clear' }), Abort: () => ({ _tag: 'Abort' }) },
  },
}))

vi.mock('./InlinePresence', () => ({
  Provider: ({ children }: React.PropsWithChildren<{}>) => <>{children}</>,
  useInlined: () => false,
}))

type Mode = 'suspend' | 'ok'
const mode = vi.hoisted(() => ({ current: 'ok' as Mode }))
const release = vi.hoisted(() => ({ current: () => {} }))

// Chat throws off `state.events`, which `Assistant.Provider` holds above the
// boundary: a reset alone remounts Chat onto the same failing events, so only
// the Clear dispatch can make Retry succeed. Nothing here repairs the cause on
// the test's behalf.
const conversation = vi.hoisted(() => ({ events: [] as string[] }))

vi.mock('./Chat', () => ({
  default: ({ state }: { state: { events: string[] } }) => {
    if (mode.current === 'suspend') {
      throw new Promise<void>((resolve) => {
        release.current = () => {
          mode.current = 'ok'
          resolve()
        }
      })
    }
    if (state.events.includes('poison')) throw new Error('chat exploded')
    return <div>chat body</div>
  },
}))

// Stands in for the actor above the boundary, including the part that decides
// whether Retry can work at all: the real machine has no `Clear` transition out
// of WaitingForAssistant or ToolUse and leaves the state untouched when an
// action is unhandled (utils/Actor.ts), so `Clear` lands only once `Abort` has
// returned the conversation to idle.
function renderPanel({ busy = false }: { busy?: boolean } = {}) {
  const rerenderRef: { current: () => void } = { current: () => {} }
  const idle = { current: !busy }
  const dispatch = vi.fn((action: { _tag?: string }) => {
    if (action?._tag === 'Abort') idle.current = true
    if (action?._tag === 'Clear' && idle.current) {
      conversation.events = []
      rerenderRef.current()
    }
  })
  const Harness = () => {
    const [, force] = React.useReducer((n: number) => n + 1, 0)
    rerenderRef.current = force
    useAssistantAPI.mockReturnValue({
      visible: true,
      show: vi.fn(),
      hide: vi.fn(),
      state: { events: conversation.events },
      dispatch,
      devTools: {},
      connectors: {},
      instructions: {},
    })
    return (
      <WithAssistantUI>
        <div>the page</div>
      </WithAssistantUI>
    )
  }
  return {
    dispatch,
    ...render(
      <React.Suspense fallback={<div>App-level placeholder</div>}>
        <Harness />
      </React.Suspense>,
    ),
  }
}

describe('components/Assistant/UI PanelBoundary', () => {
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mode.current = 'ok'
    conversation.events = []
  })

  afterEach(() => {
    cleanup()
    consoleError.mockRestore()
    vi.clearAllMocks()
  })

  it('keeps the page on screen while the chat suspends', async () => {
    mode.current = 'suspend'
    const { queryByText, findByText } = renderPanel()
    expect(queryByText('App-level placeholder')).toBeNull()
    expect(queryByText('the page')).toBeTruthy()
    release.current()
    expect(await findByText('chat body')).toBeTruthy()
  })

  it('keeps the page on screen when the chat throws, and shows the reason', () => {
    conversation.events = ['poison']
    const { queryByText, getByText } = renderPanel()
    expect(queryByText('the page')).toBeTruthy()
    expect(getByText('Qurator could not load')).toBeTruthy()
    expect(getByText('chat exploded')).toBeTruthy()
  })

  // The cause outlives the boundary, so a reset that did not clear it would
  // remount Chat straight back onto the fallback.
  it('clears the conversation on retry, so the retry can succeed', () => {
    conversation.events = ['poison']
    const { queryByText, getByText, dispatch } = renderPanel()
    expect(getByText('Qurator could not load')).toBeTruthy()
    fireEvent.click(getByText('Clear and retry'))
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ _tag: 'Clear' }))
    expect(queryByText('chat body')).toBeTruthy()
    expect(queryByText('Qurator could not load')).toBeNull()
  })

  it('recovers when the chat fails mid-request, where Clear alone does nothing', () => {
    conversation.events = ['poison']
    const { queryByText, getByText, dispatch } = renderPanel({ busy: true })
    expect(getByText('Qurator could not load')).toBeTruthy()
    fireEvent.click(getByText('Clear and retry'))
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ _tag: 'Abort' }))
    expect(queryByText('chat body')).toBeTruthy()
    expect(queryByText('Qurator could not load')).toBeNull()
  })
})
