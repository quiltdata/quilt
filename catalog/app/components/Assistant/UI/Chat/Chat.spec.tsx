import * as React from 'react'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeOptions, ThemeProvider, createMuiTheme } from '@material-ui/core/styles'

vi.mock('constants/config', () => ({ default: {} }))

// ToolCallGroup renders tool-call details via JsonDisplay, whose styles use
// the app theme's `typography.monospace` extension (absent from MUI's default).
const theme = createMuiTheme({
  typography: {
    monospace: {
      fontFamily: 'monospace',
    },
  } as ThemeOptions['typography'],
})

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}

    unobserve() {}

    disconnect() {}
  },
)

// `useIsInStack` normally suspends on the buckets query; the link rewrite only
// needs the membership predicate.
vi.mock('utils/Buckets', () => ({
  useIsInStack: () => (bucket: string) => bucket === 'in-stack-bucket',
}))

import * as Model from '../../Model'

import { ConnectorHelperLine, Menu, MessageEvent, ToolCallGroup } from './Chat'

// Rendered inside `FormHelperText` (a <p>), so the line must stay inline-only:
// any block element there is invalid DOM nesting.

const error: Model.Connectors.BackendError = { _tag: 'Transport', message: 'down' }

const fakeConnector = {
  config: { title: 'Quilt Platform tools' },
} as unknown as Model.Connectors.ConnectorRuntime

const BLOCK_SELECTOR = 'div, p, ul, ol, li, table, section, article, h1, h2, h3'

function renderLine(state: Model.Connectors.ConnectorState) {
  return render(
    <p>
      <ConnectorHelperLine connector={fakeConnector} state={state} />
    </p>,
  )
}

describe('components/Assistant/UI/Chat/ConnectorHelperLine', () => {
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleError.mockRestore()
    cleanup()
  })

  it('renders the Connecting state inline-only inside a <p>', () => {
    const { container } = renderLine(Model.Connectors.ConnectorState.Connecting())
    expect(container.textContent).toMatch(/connecting/i)
    expect(container.querySelector('p')?.querySelector(BLOCK_SELECTOR)).toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('renders the Disconnected state inline-only inside a <p>', () => {
    const { container } = renderLine(
      Model.Connectors.ConnectorState.Disconnected({ retrying: true, error }),
    )
    expect(container.textContent).toMatch(/reconnecting/i)
    expect(container.querySelector('p')?.querySelector(BLOCK_SELECTOR)).toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('renders the acked Failed state inline-only inside a <p>', () => {
    const { container } = renderLine(
      Model.Connectors.ConnectorState.Failed({ error, acked: true }),
    )
    expect(container.textContent).toMatch(/unavailable/i)
    expect(container.querySelector('p')?.querySelector(BLOCK_SELECTOR)).toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('renders the unacked Failed state inline-only inside a <p>', () => {
    const { container } = renderLine(
      Model.Connectors.ConnectorState.Failed({ error, acked: false }),
    )
    expect(container.textContent).toMatch(/continue without/i)
    expect(container.querySelector('p')?.querySelector(BLOCK_SELECTOR)).toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('renders nothing for the Ready state', () => {
    const { container } = renderLine(
      Model.Connectors.ConnectorState.Ready({ tools: {}, resources: [] }),
    )
    expect(container.querySelector('p')?.textContent).toBe('')
  })
})

// The bug this guards: `Markdown` was rendered without `processLink`, so a
// foreign host in an assistant answer was followed verbatim onto another stack.
describe('components/Assistant/UI/Chat/MessageEvent link rewriting', () => {
  const ORIGIN = window.location.origin

  afterEach(cleanup)

  function renderMessage(role: 'user' | 'assistant', text: string) {
    return render(
      <MessageEvent
        _tag="Message"
        state="Idle"
        id="m1"
        timestamp={new Date()}
        dispatch={() => true}
        role={role}
        content={Model.Content.MessageContentBlock.Text({ text })}
      />,
    )
  }

  it("retargets an assistant link to this stack's bucket onto this origin", async () => {
    renderMessage(
      'assistant',
      '[open it](https://open.quiltdata.com/b/in-stack-bucket/tree/x.csv)',
    )
    const link = await screen.findByRole('link')
    expect(link.getAttribute('href')).toBe('/b/in-stack-bucket/tree/x.csv')
  })

  it('leaves an assistant link to a bucket this stack lacks alone', async () => {
    const href = 'https://open.quiltdata.com/b/other-bucket/tree/x.csv'
    renderMessage('assistant', `[open it](${href})`)
    const link = await screen.findByRole('link')
    expect(link.getAttribute('href')).toBe(href)
  })

  it('leaves a link the user typed alone', async () => {
    const href = 'https://open.quiltdata.com/b/in-stack-bucket/tree/x.csv'
    renderMessage('user', `[open it](${href})`)
    const link = await screen.findByRole('link')
    expect(link.getAttribute('href')).toBe(href)
  })

  it('leaves an assistant link already on this origin alone', async () => {
    const href = `${ORIGIN}/b/in-stack-bucket/tree/x.csv`
    renderMessage('assistant', `[open it](${href})`)
    const link = await screen.findByRole('link')
    expect(link.getAttribute('href')).toBe(href)
  })
})

describe('components/Assistant/UI/Chat/ToolCallGroup', () => {
  afterEach(cleanup)

  function toolUseEvent(
    id: string,
    name: string,
    status: 'success' | 'error' = 'success',
    toolUseId = `${id}-use`,
  ): ReturnType<typeof Model.Conversation.Event.ToolUse> {
    return {
      _tag: 'ToolUse',
      id,
      timestamp: new Date(),
      toolUseId,
      name,
      input: { q: id },
      result: { status, content: [] },
    }
  }

  function renderGroup(
    props: Omit<React.ComponentProps<typeof ToolCallGroup>, 'dispatch'>,
  ) {
    return render(
      <ThemeProvider theme={theme}>
        <ToolCallGroup dispatch={vi.fn()} {...props} />
      </ThemeProvider>,
    )
  }

  // One call carries nothing a rollup would summarize, so it stays as the
  // plain per-call row (matches today's single-tool-call rendering).
  it('renders a single call as a plain row, not a rollup', () => {
    renderGroup({ state: 'Idle', events: [toolUseEvent('1', 'search_packages')] })
    expect(screen.getByText('search_packages')).toBeTruthy()
    expect(screen.queryByText(/tool calls/)).toBeNull()
  })

  it('summarizes multiple finished calls into one count, collapsed by default', () => {
    renderGroup({
      state: 'Idle',
      events: [
        toolUseEvent('1', 'search_packages'),
        toolUseEvent('2', 'package_revision'),
        toolUseEvent('3', 'object_read'),
      ],
    })
    expect(screen.getByText('3 tool calls')).toBeTruthy()
    // M.Collapse keeps collapsed content in the DOM (height-animated, not
    // unmounted) -- the toggle button's aria-expanded is the real signal.
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('false')
  })

  it('names the actively running call in the summary line', () => {
    renderGroup({
      state: 'ToolUse',
      events: [toolUseEvent('1', 'search_packages')],
      live: {
        timestamp: new Date(),
        calls: {
          'call-2': { name: 'package_revision', input: {}, fiber: {} as any },
        },
      },
    })
    expect(screen.getByText('Running: package_revision')).toBeTruthy()
  })

  it('surfaces a failed call in the summary without expanding', () => {
    renderGroup({
      state: 'Idle',
      events: [
        toolUseEvent('1', 'search_packages', 'success'),
        toolUseEvent('2', 'object_read', 'error'),
      ],
    })
    expect(screen.getByText('2 tool calls, 1 failed')).toBeTruthy()
  })

  it('expands to reveal every call, including the failed one', () => {
    renderGroup({
      state: 'Idle',
      events: [
        toolUseEvent('1', 'search_packages', 'success'),
        toolUseEvent('2', 'object_read', 'error'),
      ],
    })
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('search_packages')).toBeTruthy()
    expect(screen.getByText('object_read')).toBeTruthy()
  })

  // A retry isn't representable in today's event stream (the reducer
  // dispatches exactly one ToolResult per toolUseId), but the rollup counts
  // by toolUseId specifically so a future retry's earlier failed attempt
  // never inflates the failure count once the same call later succeeds.
  it('counts a call once by its final status, not once per event sharing its toolUseId', () => {
    renderGroup({
      state: 'Idle',
      events: [
        toolUseEvent('1', 'object_read', 'error', 'shared-use'),
        toolUseEvent('2', 'object_read', 'success', 'shared-use'),
        toolUseEvent('3', 'search_packages', 'success'),
      ],
    })
    expect(screen.getByText('2 tool calls')).toBeTruthy()
    expect(screen.queryByText(/failed/)).toBeNull()
  })
})

describe('components/Assistant/UI/Chat/Menu', () => {
  afterEach(cleanup)

  const idle = { _tag: 'Idle' } as Model.Assistant.API['state']

  function renderMenu(devToolsOpen: boolean, onToggleDevTools = vi.fn()) {
    render(
      <Menu
        state={idle}
        dispatch={vi.fn()}
        devToolsOpen={devToolsOpen}
        onToggleDevTools={onToggleDevTools}
      />,
    )
    return onToggleDevTools
  }

  // The header's own X closes the panel; the menu must not add a second one.
  it('adds no close control while Developer Tools is open', () => {
    renderMenu(true)
    expect(screen.queryByText('close')).toBeNull()
    expect(
      screen.getAllByRole('button').map((b) => b.getAttribute('aria-label')),
    ).toEqual(['Qurator menu'])
  })

  it('hides Developer Tools from the menu that opened it', () => {
    const toggle = renderMenu(true)
    fireEvent.click(screen.getByLabelText('Qurator menu'))
    fireEvent.click(screen.getByText('Hide Developer Tools'))
    expect(toggle).toHaveBeenCalledTimes(1)
  })

  it('CONTROL: offers Developer Tools while it is closed', () => {
    renderMenu(false)
    fireEvent.click(screen.getByLabelText('Qurator menu'))
    expect(screen.getByText('Developer Tools')).toBeTruthy()
  })
})
