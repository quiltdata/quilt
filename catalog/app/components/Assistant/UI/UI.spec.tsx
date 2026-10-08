import * as React from 'react'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import { PANEL_WIDTH, RAIL_WIDTH, usePanelGutter } from './PanelReflow'
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

let chat: { open: boolean; show: () => void; hide: () => void } | null = null
vi.mock('components/HubSpot', () => ({
  useChat: () => chat,
}))
vi.mock('./Help', () => ({
  default: () => <div data-testid="help" />,
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
  return <span data-testid="reflow">{String(usePanelGutter())}</span>
}

// jsdom has no PointerEvent, and a MouseEvent drops `pointerId`.
class FakePointerEvent extends MouseEvent {
  pointerId: number
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerId = init.pointerId ?? 0
  }
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
    chat = null
    delete (window as any).matchMedia
  })

  // Above the breakpoint the paper is always on screen -- collapsed to a rail
  // or expanded. Only the overlay variant takes it away.
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

  it('stays on screen as a rail when not visible, and expands from it', () => {
    const api = makeAPI()
    useAssistantAPI.mockReturnValue(api)
    const { baseElement, getByTestId, getByLabelText } = render(
      <WithAssistantUI>
        <Reflow />
      </WithAssistantUI>,
    )
    expect(paper(baseElement)).toBeTruthy()
    expect(chatProps).toBeNull()
    expect(getByTestId('reflow').textContent).toBe(RAIL_WIDTH)
    fireEvent.click(getByLabelText('Ask Qurator'))
    expect(api.show).toHaveBeenCalled()
  })

  it('renders no panel at all while an inline chat is active, even when visible', () => {
    inlined = true
    const api = makeAPI()
    api.visible = true
    useAssistantAPI.mockReturnValue(api)
    const { baseElement, getByTestId } = render(
      <WithAssistantUI>
        <Reflow />
      </WithAssistantUI>,
    )
    expect(baseElement.querySelector('.MuiDrawer-root')).toBeFalsy()
    expect(getByTestId('reflow').textContent).toBe('null')
  })

  it('expands to the full panel and widens the gutter when visible', () => {
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
    expect(chatProps).toBeTruthy()
    expect(getByTestId('reflow').textContent).toBe(PANEL_WIDTH)
  })

  it("shows Help as the panel's second face, on the same gutter, and steps Qurator aside", () => {
    const api = makeAPI()
    api.visible = true
    useAssistantAPI.mockReturnValue(api)
    chat = { open: true, show: vi.fn(), hide: vi.fn() }
    const { baseElement, getByTestId } = render(
      <WithAssistantUI>
        <Reflow />
      </WithAssistantUI>,
    )
    expect(baseElement.querySelector('.MuiDrawer-docked')).toBeTruthy()
    expect(getByTestId('help')).toBeTruthy()
    expect(chatProps).toBeNull()
    expect(getByTestId('reflow').textContent).toBe(PANEL_WIDTH)
    expect(api.hide).toHaveBeenCalled()
  })

  it('offers Help on the collapsed rail beside Qurator', () => {
    useAssistantAPI.mockReturnValue(makeAPI())
    chat = { open: false, show: vi.fn(), hide: vi.fn() }
    const { getByLabelText, getByTestId } = render(
      <WithAssistantUI>
        <Reflow />
      </WithAssistantUI>,
    )
    expect(getByLabelText('Ask Qurator')).toBeTruthy()
    expect(getByTestId('reflow').textContent).toBe(RAIL_WIDTH)
    fireEvent.click(getByLabelText('Help'))
    expect(chat.show).toHaveBeenCalled()
  })

  it('docks Help alone when there is no Qurator', () => {
    useAssistantAPI.mockReturnValue(null)
    chat = { open: true, show: vi.fn(), hide: vi.fn() }
    const { getByTestId } = render(
      <WithAssistantUI>
        <Reflow />
      </WithAssistantUI>,
    )
    expect(getByTestId('help')).toBeTruthy()
    expect(getByTestId('reflow').textContent).toBe(PANEL_WIDTH)
  })

  it('returns focus to the Help rail button when Help collapses', () => {
    useAssistantAPI.mockReturnValue(makeAPI())
    chat = { open: true, show: vi.fn(), hide: vi.fn() }
    const { rerender, getByLabelText } = render(<WithAssistantUI />)
    chat = { ...chat, open: false }
    rerender(<WithAssistantUI />)
    expect(document.activeElement).toBe(getByLabelText('Help'))
  })

  it('leaves Help open when Qurator is shown inline on the page', () => {
    inlined = true
    const api = makeAPI()
    useAssistantAPI.mockReturnValue(api)
    chat = { open: true, show: vi.fn(), hide: vi.fn() }
    const { rerender } = render(<WithAssistantUI />)
    api.visible = true
    rerender(<WithAssistantUI />)
    expect(chat.hide).not.toHaveBeenCalled()
    expect(api.hide).not.toHaveBeenCalled()
  })

  it('closes Help when Qurator opens', () => {
    const api = makeAPI()
    useAssistantAPI.mockReturnValue(api)
    chat = { open: false, show: vi.fn(), hide: vi.fn() }
    const { rerender } = render(<WithAssistantUI />)
    expect(chat.hide).not.toHaveBeenCalled()
    api.visible = true
    rerender(<WithAssistantUI />)
    expect(chat.hide).toHaveBeenCalled()
  })

  it('keeps Help, not Qurator, in the compact overlay while it slides shut', () => {
    narrowViewport()
    useAssistantAPI.mockReturnValue(makeAPI())
    chat = { open: true, show: vi.fn(), hide: vi.fn() }
    const { rerender, queryByTestId } = render(<WithAssistantUI />)
    expect(queryByTestId('help')).toBeTruthy()
    chat = { ...chat, open: false }
    rerender(<WithAssistantUI />)
    expect(chatProps).toBeNull()
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
    expect(getByTestId('reflow').textContent).toBe('null')
  })

  // Read from the applied class name, not the sheet: the sheet carries every
  // rule whether or not it is used.
  const hasRule = (el: Element, key: string) =>
    el.className.split(' ').some((c) => c.startsWith(`makeStyles-${key}-`))

  // The winning declaration for `width` among the rules this element carries.
  // Read from the sheet rather than `getComputedStyle`: jsdom does not cascade
  // author stylesheets, so computed style reports nothing for either rule.
  const widthFor = (el: Element, key: string) => {
    const cls = el.className.split(' ').find((c) => c.startsWith(`makeStyles-${key}-`))
    if (!cls) return null
    const css = [...document.querySelectorAll('style')]
      .map((s) => s.textContent || '')
      .join('\n')
    // `&&` compiles to the class doubled, which is the rule that has to win.
    const rule = css.split('}').find((r) => r.includes(`.${cls}.${cls}`))
    const m = rule?.match(/width:\s*([^;]+)/)
    return m ? m[1].trim() : null
  }

  it('gives the overlay a full-width paper the docked panel does not take', () => {
    narrowViewport()
    const api = makeAPI()
    api.visible = true
    useAssistantAPI.mockReturnValue(api)
    const { baseElement } = render(<WithAssistantUI />)
    const el = paper(baseElement)!
    expect(hasRule(el, 'paperCompact')).toBe(true)
    // Not just applied: it has to win the width. `paper` sets one too, at equal
    // specificity, so a class on the element proves nothing about the cascade.
    expect(widthFor(el, 'paperCompact')).toBe('min(40rem, 100vw)')
  })

  it('leaves the docked paper on the gutter width, with no overlay override', () => {
    const api = makeAPI()
    api.visible = true
    useAssistantAPI.mockReturnValue(api)
    const { baseElement } = render(<WithAssistantUI />)
    expect(hasRule(paper(baseElement)!, 'paperCompact')).toBe(false)
    expect(hasRule(paper(baseElement)!, 'paper')).toBe(true)
  })

  it('takes the panel away entirely below 960px when not visible', () => {
    narrowViewport()
    useAssistantAPI.mockReturnValue(makeAPI())
    const { baseElement } = render(<WithAssistantUI />)
    expect(paper(baseElement)).toBeFalsy()
  })

  it('collapses the docked panel to a rail on Escape', () => {
    const api = makeAPI()
    api.visible = true
    useAssistantAPI.mockReturnValue(api)
    render(<WithAssistantUI />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(api.hide).toHaveBeenCalled()
  })

  it('hands the chat its wiring and a way to collapse the panel', () => {
    const api = makeAPI()
    api.visible = true
    useAssistantAPI.mockReturnValue(api)
    render(<WithAssistantUI />)
    expect(chatProps?.instructions).toBe(api.instructions)
    expect(chatProps?.connectors).toBe(api.connectors)
    chatProps?.onClose()
    expect(api.hide).toHaveBeenCalled()
  })

  describe('resizing', () => {
    const KEY = 'QURATOR_PANEL_WIDTH'
    // jsdom's viewport is 1024px wide: the default is 50vw, the cap 1024 - 480.
    const DEFAULT = 512
    const MAX = 544

    afterEach(() => {
      localStorage.clear()
      vi.restoreAllMocks()
      vi.unstubAllGlobals()
    })

    function renderOpen() {
      const api = makeAPI()
      api.visible = true
      useAssistantAPI.mockReturnValue(api)
      return render(
        <WithAssistantUI>
          <Reflow />
        </WithAssistantUI>,
      )
    }

    it('offers a keyboard-operable vertical separator on the open docked panel', () => {
      const { getByRole, getByTestId } = renderOpen()
      const handle = getByRole('separator', { name: 'Resize Qurator' })
      expect(handle.getAttribute('aria-orientation')).toBe('vertical')
      expect(handle.getAttribute('aria-valuenow')).toBe(String(DEFAULT))
      fireEvent.keyDown(handle, { key: 'ArrowLeft' })
      expect(handle.getAttribute('aria-valuenow')).toBe(String(DEFAULT + 32))
      expect(getByTestId('reflow').textContent).toBe(
        `clamp(320px, ${DEFAULT + 32}px, min(70vw, 100vw - 480px))`,
      )
      expect(localStorage.getItem(KEY)).toBe(String(DEFAULT + 32))
    })

    it('ignores a second pointer while one is dragging', () => {
      vi.stubGlobal('PointerEvent', window.PointerEvent ?? FakePointerEvent)
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
        right: 1024,
      } as DOMRect)
      const { getByRole } = renderOpen()
      const handle = getByRole('separator')
      fireEvent.pointerDown(handle, { pointerId: 1 })
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 624 })
      fireEvent.pointerMove(handle, { pointerId: 2, clientX: 900 })
      fireEvent.pointerUp(handle, { pointerId: 2 })
      expect(document.body.hasAttribute('data-qurator-dragging')).toBe(true)
      fireEvent.pointerUp(handle, { pointerId: 1 })
      expect(localStorage.getItem(KEY)).toBe('400')
    })

    it('does not start a drag it cannot capture', () => {
      vi.stubGlobal('PointerEvent', window.PointerEvent ?? FakePointerEvent)
      const { getByRole } = renderOpen()
      const handle = getByRole('separator')
      handle.setPointerCapture = () => {
        throw new Error('InvalidPointerId')
      }
      fireEvent.pointerDown(handle, { pointerId: 1 })
      expect(document.body.hasAttribute('data-qurator-dragging')).toBe(false)
    })

    it('follows the pointer from the paper edge', () => {
      // jsdom has no PointerEvent, and a plain Event drops `clientX`.
      vi.stubGlobal('PointerEvent', window.PointerEvent ?? FakePointerEvent)
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
        right: 1024,
      } as DOMRect)
      const { getByRole } = renderOpen()
      const handle = getByRole('separator')
      fireEvent.pointerDown(handle, { pointerId: 1 })
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 624 })
      expect(document.body.hasAttribute('data-qurator-dragging')).toBe(true)
      expect(localStorage.getItem(KEY)).toBeNull()
      fireEvent.pointerUp(handle, { pointerId: 1 })
      expect(document.body.hasAttribute('data-qurator-dragging')).toBe(false)
      expect(localStorage.getItem(KEY)).toBe('400')
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 524 })
      expect(handle.getAttribute('aria-valuenow')).toBe('400')
    })

    it('keeps the dragged width when the panel closes mid-drag', () => {
      vi.stubGlobal('PointerEvent', window.PointerEvent ?? FakePointerEvent)
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
        right: 1024,
      } as DOMRect)
      const { getByRole, unmount } = renderOpen()
      const handle = getByRole('separator')
      fireEvent.pointerDown(handle, { pointerId: 1 })
      fireEvent.pointerMove(handle, { pointerId: 1, clientX: 624 })
      unmount()
      expect(document.body.hasAttribute('data-qurator-dragging')).toBe(false)
      expect(localStorage.getItem(KEY)).toBe('400')
    })

    it('clamps to the minimum and to a share of the viewport', () => {
      const { getByRole } = renderOpen()
      const handle = getByRole('separator')
      for (let i = 0; i < 20; i++) fireEvent.keyDown(handle, { key: 'ArrowRight' })
      expect(localStorage.getItem(KEY)).toBe('320')
      for (let i = 0; i < 20; i++) fireEvent.keyDown(handle, { key: 'ArrowLeft' })
      expect(localStorage.getItem(KEY)).toBe(String(MAX))
      expect(handle.getAttribute('aria-valuemax')).toBe(String(MAX))
    })

    it('jumps to the minimum with Home and the maximum with End', () => {
      const { getByRole } = renderOpen()
      const handle = getByRole('separator')
      fireEvent.keyDown(handle, { key: 'End' })
      expect(localStorage.getItem(KEY)).toBe(String(MAX))
      fireEvent.keyDown(handle, { key: 'Home' })
      expect(localStorage.getItem(KEY)).toBe('320')
    })

    it('restores the saved width on the next load', () => {
      localStorage.setItem(KEY, '480')
      const { getByRole, getByTestId } = renderOpen()
      expect(getByRole('separator').getAttribute('aria-valuenow')).toBe('480')
      expect(getByTestId('reflow').textContent).toBe(
        'clamp(320px, 480px, min(70vw, 100vw - 480px))',
      )
    })

    it('follows the viewport as the window resizes', () => {
      localStorage.setItem(KEY, '480')
      const { getByRole } = renderOpen()
      const handle = getByRole('separator')
      vi.stubGlobal('innerWidth', 800)
      fireEvent(window, new Event('resize'))
      expect(handle.getAttribute('aria-valuemax')).toBe('320')
      expect(handle.getAttribute('aria-valuenow')).toBe('320')
    })

    it('falls back to the default width when storage is unreadable', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError')
      })
      const { getByTestId } = renderOpen()
      expect(getByTestId('reflow').textContent).toBe(PANEL_WIDTH)
    })

    it('offers no handle on the rail or the overlay', () => {
      useAssistantAPI.mockReturnValue(makeAPI())
      render(<WithAssistantUI />)
      expect(document.querySelector('[role=separator]')).toBeFalsy()
      cleanup()
      narrowViewport()
      renderOpen()
      expect(document.querySelector('[role=separator]')).toBeFalsy()
    })
  })

  it('offers the rail button as the only affordance, with no second trigger', () => {
    useAssistantAPI.mockReturnValue(makeAPI())
    const { getAllByRole, getByLabelText } = render(<WithAssistantUI />)
    expect(getAllByRole('button')).toHaveLength(1)
    expect(getByLabelText('Ask Qurator').getAttribute('aria-expanded')).toBe('false')
  })
})
