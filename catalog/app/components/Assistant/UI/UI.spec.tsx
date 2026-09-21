import * as React from 'react'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import { usePanelReflow } from './PanelReflow'
import { WithAssistantUI, Trigger } from './UI'

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
    delete (window as any).matchMedia
  })

  // The panel is docked, so `.MuiDrawer-root` is in the tree whether it is open
  // or not; the paper is what `unmountOnExit` takes away when it closes.
  const paper = (el: HTMLElement) => el.querySelector('.MuiDrawer-paper')

  // jsdom ships no matchMedia, so MUI reports false for every query -- a wide
  // viewport with no motion preference. The compact branch needs the opposite
  // answer for the width query alone: the panel asks two.
  const narrowViewport = () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as any
  }

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

  it('stays an overlay below 960px and reserves no gutter', () => {
    narrowViewport()
    const api = makeAPI()
    api.visible = true
    useAssistantAPI.mockReturnValue(api)
    const { baseElement, getByTestId } = render(
      <WithAssistantUI>
        <Reflow />
      </WithAssistantUI>,
    )
    expect(paper(baseElement)).toBeTruthy()
    expect(baseElement.querySelector('.MuiDrawer-docked')).toBeFalsy()
    expect(getByTestId('reflow').textContent).toBe('false')
  })

  it('closes the docked panel on Escape', () => {
    const api = makeAPI()
    api.visible = true
    useAssistantAPI.mockReturnValue(api)
    render(<WithAssistantUI />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(api.hide).toHaveBeenCalled()
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
