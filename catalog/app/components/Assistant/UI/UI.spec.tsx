import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import { WithAssistantUI } from './UI'

const useAssistantAPI = vi.fn()

vi.mock('../Model', () => ({
  useAssistantAPI: () => useAssistantAPI(),
}))

// Render the Chat subtree as a no-op; these tests only assert Fab/Drawer presence.
vi.mock('./Chat', () => ({
  default: () => null,
}))

let inlined = false
vi.mock('./InlinePresence', () => ({
  Provider: ({ children }: React.PropsWithChildren<{}>) => <>{children}</>,
  useInlined: () => inlined,
}))

function makeAPI() {
  return {
    visible: false,
    show: vi.fn(),
    hide: vi.fn(),
    state: {},
    dispatch: vi.fn(),
    devTools: {},
    connectors: {},
  }
}

describe('components/Assistant/UI', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    inlined = false
  })

  it('shows the Fab when no inline chat is active', () => {
    useAssistantAPI.mockReturnValue(makeAPI())
    const { queryByRole } = render(<WithAssistantUI />)
    expect(queryByRole('button')).toBeTruthy()
  })

  it('hides the Fab while an inline chat is active', () => {
    inlined = true
    useAssistantAPI.mockReturnValue(makeAPI())
    const { queryByRole } = render(<WithAssistantUI />)
    expect(queryByRole('button')).toBeFalsy()
  })

  it('keeps the sidebar closed while an inline chat is active, even when visible', () => {
    inlined = true
    const api = makeAPI()
    api.visible = true
    useAssistantAPI.mockReturnValue(api)
    const { baseElement } = render(<WithAssistantUI />)
    expect(baseElement.querySelector('.MuiDrawer-root')).toBeFalsy()
  })

  it('opens the sidebar when visible and no inline chat is active', () => {
    const api = makeAPI()
    api.visible = true
    useAssistantAPI.mockReturnValue(api)
    const { baseElement } = render(<WithAssistantUI />)
    expect(baseElement.querySelector('.MuiDrawer-root')).toBeTruthy()
  })
})
