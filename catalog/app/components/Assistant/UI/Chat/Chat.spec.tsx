import * as React from 'react'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))

// `useIsInStack` normally suspends on the buckets query; the link rewrite only
// needs the membership predicate.
vi.mock('utils/Buckets', () => ({
  useIsInStack: () => (bucket: string) => bucket === 'in-stack-bucket',
}))

import * as Model from '../../Model'

import { ConnectorHelperLine, Menu, MessageEvent } from './Chat'

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

describe('components/Assistant/UI/Chat/ConnectorHelperLine sign-in', () => {
  afterEach(cleanup)

  it('offers connect when the server needs the user to sign in', () => {
    const onConnect = vi.fn()
    const connector = {
      id: 'slack',
      config: { title: 'Slack', optional: true },
    } as unknown as Model.Connectors.ConnectorRuntime
    render(
      <ConnectorHelperLine
        connector={connector}
        state={Model.Connectors.ConnectorState.Failed({
          error: { _tag: 'Auth', message: 'sign in', needsSignIn: true },
          acked: false,
        })}
        onConnect={onConnect}
      />,
    )
    expect(screen.getByText(/Slack: not connected/)).toBeTruthy()
    expect(screen.queryByText('reconnect')).toBeNull()
    fireEvent.click(screen.getByText('connect'))
    expect(onConnect).toHaveBeenCalledWith('slack')
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

  it('lists Connect or Disconnect for each server users sign in to', () => {
    const connect = vi.fn()
    const disconnect = vi.fn()
    render(
      <Menu
        state={idle}
        dispatch={vi.fn()}
        devToolsOpen={false}
        onToggleDevTools={vi.fn()}
        mcpSignIn={{
          servers: [
            { slug: 'slack', title: 'Slack', signedIn: false },
            { slug: 'fathom', title: 'Fathom', signedIn: true },
          ],
          pending: null,
          status: '',
          connect,
          disconnect,
        }}
      />,
    )
    fireEvent.click(screen.getByLabelText('Qurator menu'))
    fireEvent.click(screen.getByText('Connect Slack'))
    expect(connect.mock.calls[0][0]).toBe('slack')
    fireEvent.click(screen.getByLabelText('Qurator menu'))
    fireEvent.click(screen.getByText('Disconnect Fathom'))
    expect(disconnect.mock.calls[0][0]).toBe('fathom')
  })

  it('offers Connect when the connector needs sign-in, whatever the cached list says', () => {
    render(
      <Menu
        state={idle}
        dispatch={vi.fn()}
        devToolsOpen={false}
        onToggleDevTools={vi.fn()}
        needsSignIn={new Set(['fathom'])}
        mcpSignIn={{
          servers: [{ slug: 'fathom', title: 'Fathom', signedIn: true }],
          pending: null,
          status: '',
          connect: vi.fn(),
          disconnect: vi.fn(),
        }}
      />,
    )
    fireEvent.click(screen.getByLabelText('Qurator menu'))
    expect(screen.getByText('Connect Fathom')).toBeTruthy()
    expect(screen.queryByText('Disconnect Fathom')).toBeNull()
  })

  it('CONTROL: offers Developer Tools while it is closed', () => {
    renderMenu(false)
    fireEvent.click(screen.getByLabelText('Qurator menu'))
    expect(screen.getByText('Developer Tools')).toBeTruthy()
  })
})
