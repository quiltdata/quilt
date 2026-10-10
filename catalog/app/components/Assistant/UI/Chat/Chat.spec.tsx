import * as React from 'react'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))

// Its styles read the app theme's monospace font, absent here.
vi.mock('components/JsonDisplay', () => ({ default: () => null }))

// `useIsInStack` normally suspends on the buckets query; the link rewrite only
// needs the membership predicate.
vi.mock('utils/Buckets', () => ({
  useIsInStack: () => (bucket: string) => bucket === 'in-stack-bucket',
}))

import * as Model from '../../Model'

import { ConnectorHelperLine, Menu, MessageEvent, ToolUseState, toolTitle } from './Chat'

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

describe('components/Assistant/UI/Chat/Menu', () => {
  afterEach(cleanup)

  const idle = { _tag: 'Idle' } as Model.Assistant.API['state']

  const sessionsStub = (
    over: Partial<Model.Assistant.API['sessions']> = {},
  ): Model.Assistant.API['sessions'] => ({
    available: true,
    enabled: false,
    setEnabled: vi.fn(),
    list: [],
    currentId: null,
    open: vi.fn(),
    remove: vi.fn(),
    ...over,
  })

  function renderMenu(
    devToolsOpen: boolean,
    onToggleDevTools = vi.fn(),
    sessions = sessionsStub(),
  ) {
    render(
      <Menu
        state={idle}
        dispatch={vi.fn()}
        sessions={sessions}
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

  it('turns kept sessions on from the menu', () => {
    const sessions = sessionsStub()
    renderMenu(false, vi.fn(), sessions)
    fireEvent.click(screen.getByLabelText('Qurator menu'))
    fireEvent.click(screen.getByText('Keep sessions in this browser (preview)'))
    expect(sessions.setEnabled).toHaveBeenCalledWith(true)
  })

  const kept = () =>
    sessionsStub({
      enabled: true,
      list: [
        {
          id: 's1',
          title: 'Find my packages',
          updatedAt: new Date().toISOString(),
          envelope: { v: 1, events: [] },
        },
      ],
    })

  it('asks before turning off deletes kept sessions', () => {
    const sessions = kept()
    renderMenu(false, vi.fn(), sessions)
    fireEvent.click(screen.getByLabelText('Qurator menu'))
    fireEvent.click(screen.getByText('Keep sessions in this browser (preview)'))
    expect(sessions.setEnabled).not.toHaveBeenCalled()
    expect(
      screen.getByText('This deletes the 1 session kept in this browser.'),
    ).toBeTruthy()
    fireEvent.click(screen.getByText('Delete and turn off'))
    expect(sessions.setEnabled).toHaveBeenCalledWith(false)
  })

  it('keeps sessions when turning off is cancelled', () => {
    const sessions = kept()
    renderMenu(false, vi.fn(), sessions)
    fireEvent.click(screen.getByLabelText('Qurator menu'))
    fireEvent.click(screen.getByText('Keep sessions in this browser (preview)'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(sessions.setEnabled).not.toHaveBeenCalled()
  })

  it('opens and deletes a recent session', () => {
    const sessions = sessionsStub({
      enabled: true,
      list: [
        {
          id: 's1',
          title: 'Find my packages',
          updatedAt: new Date().toISOString(),
          envelope: { v: 1, events: [] },
        },
      ],
    })
    renderMenu(false, vi.fn(), sessions)
    fireEvent.click(screen.getByLabelText('Qurator menu'))
    fireEvent.click(screen.getByLabelText('Delete session: Find my packages'))
    expect(sessions.remove).toHaveBeenCalledWith('s1')
    expect(sessions.open).not.toHaveBeenCalled()
    fireEvent.keyDown(screen.getByRole('menuitem', { name: /Find my packages/ }), {
      key: 'Delete',
    })
    expect(sessions.remove).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByText('Find my packages'))
    expect(sessions.open).toHaveBeenCalledWith('s1')
  })

  it('CONTROL: offers Developer Tools while it is closed', () => {
    renderMenu(false)
    fireEvent.click(screen.getByLabelText('Qurator menu'))
    expect(screen.getByText('Developer Tools')).toBeTruthy()
  })
})

describe('components/Assistant/UI/Chat/ToolUseState', () => {
  afterEach(cleanup)

  it('names tools without the connector prefix', () => {
    expect(toolTitle('platform__s3_object_put')).toBe('s3 object put')
    expect(toolTitle('navigate')).toBe('navigate')
  })

  it('asks before a pending write and dispatches the answer', () => {
    const dispatch = vi.fn()
    render(
      <ToolUseState
        dispatch={dispatch}
        timestamp={new Date()}
        calls={{
          w: {
            name: 'platform__object_delete',
            input: { bucket: 'b', key: 'k.txt' },
            approval: 'destructive',
            key: 'k1',
          },
        }}
      />,
    )
    expect(screen.getByText(/object delete/)).toBeTruthy()
    expect(screen.getByText(/replace or delete existing data/)).toBeTruthy()
    expect(screen.getByText('key: k.txt')).toBeTruthy()

    fireEvent.click(screen.getByText('Run'))
    expect(dispatch).toHaveBeenCalledWith(
      Model.Conversation.Action.Approve({ id: 'w', key: 'k1' }),
    )
    fireEvent.click(screen.getByText("Don't run"))
    expect(dispatch).toHaveBeenCalledWith(
      Model.Conversation.Action.Deny({ id: 'w', key: 'k1' }),
    )
    fireEvent.click(screen.getByText('abort'))
    expect(dispatch).toHaveBeenCalledWith(Model.Conversation.Action.Abort())
  })
})
