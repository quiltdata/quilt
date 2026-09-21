import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import { WithAssistantUI, Trigger, usePanelReflow } from './UI'

const useAssistantAPI = vi.fn()

vi.mock('../Model', () => ({
  useAssistantAPI: () => useAssistantAPI(),
}))

// Render the Chat subtree as a no-op; these tests assert the panel host, not
// the chat. Props are recorded so the wiring handed down can be checked.
let chatProps: Record<string, any> | null = null
vi.mock('./Chat', () => ({
  default: (props: Record<string, any>) => {
    chatProps = props
    return null
  },
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
    instructions: {},
  }
}

// The gutter Layout reserves is driven by this context, so read it the way
// Layout does rather than asserting on the paper's own fixed width.
function Reflow() {
  return <span data-testid="reflow">{String(usePanelReflow())}</span>
}

describe('components/Assistant/UI Trigger', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    inlined = false
  })

  it('shows the trigger button when no inline chat is active and assistant is not visible', () => {
    useAssistantAPI.mockReturnValue(makeAPI())
    const { queryByRole } = render(<Trigger />)
    expect(queryByRole('button')).toBeTruthy()
  })

  it('hides the trigger button while an inline chat is active', () => {
    inlined = true
    useAssistantAPI.mockReturnValue(makeAPI())
    const { queryByRole } = render(<Trigger />)
    expect(queryByRole('button')).toBeFalsy()
  })

  it('hides the trigger button when assistant is already visible', () => {
    const api = makeAPI()
    api.visible = true
    useAssistantAPI.mockReturnValue(api)
    const { queryByRole } = render(<Trigger />)
    expect(queryByRole('button')).toBeFalsy()
  })
})

describe('components/Assistant/UI WithAssistantUI', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    inlined = false
    chatProps = null
  })

  // The panel is docked, so `.MuiDrawer-root` is in the tree whether it is open
  // or not; the paper is what `unmountOnExit` takes away when it closes.
  const paper = (el: HTMLElement) => el.querySelector('.MuiDrawer-paper')

  it('defaults closed', () => {
    useAssistantAPI.mockReturnValue(makeAPI())
    const { baseElement, getByTestId } = render(
      <WithAssistantUI>
        <Reflow />
      </WithAssistantUI>,
    )
    expect(paper(baseElement)).toBeFalsy()
    expect(getByTestId('reflow').textContent).toBe('false')
  })

  it('keeps the panel closed while an inline chat is active, even when visible', () => {
    inlined = true
    const api = makeAPI()
    api.visible = true
    useAssistantAPI.mockReturnValue(api)
    const { baseElement, getByTestId } = render(
      <WithAssistantUI>
        <Reflow />
      </WithAssistantUI>,
    )
    expect(paper(baseElement)).toBeFalsy()
    expect(getByTestId('reflow').textContent).toBe('false')
  })

  it('opens as a docked panel and reflows content when visible', () => {
    const api = makeAPI()
    api.visible = true
    useAssistantAPI.mockReturnValue(api)
    const { baseElement, getByTestId } = render(
      <WithAssistantUI>
        <Reflow />
      </WithAssistantUI>,
    )
    expect(baseElement.querySelector('.MuiDrawer-docked')).toBeTruthy()
    expect(paper(baseElement)).toBeTruthy()
    expect(getByTestId('reflow').textContent).toBe('true')
  })

  it('hands the chat its wiring and a way to close the panel', () => {
    const api = makeAPI()
    api.visible = true
    useAssistantAPI.mockReturnValue(api)
    render(<WithAssistantUI />)
    expect(chatProps?.instructions).toBe(api.instructions)
    expect(chatProps?.connectors).toBe(api.connectors)
    chatProps?.onClose()
    expect(api.hide).toHaveBeenCalled()
  })

  it('does not render a trigger button (trigger is now inline in the top bar)', () => {
    useAssistantAPI.mockReturnValue(makeAPI())
    const { queryByRole } = render(<WithAssistantUI />)
    expect(queryByRole('button')).toBeFalsy()
  })
})
