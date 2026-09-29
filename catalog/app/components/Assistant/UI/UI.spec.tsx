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

  it('offers the rail button as the only affordance, with no second trigger', () => {
    useAssistantAPI.mockReturnValue(makeAPI())
    const { getAllByRole, getByLabelText } = render(<WithAssistantUI />)
    expect(getAllByRole('button')).toHaveLength(1)
    expect(getByLabelText('Ask Qurator').getAttribute('aria-expanded')).toBe('false')
  })
})
