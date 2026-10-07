import * as React from 'react'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))

// `useIsInStack` normally suspends on the buckets query; the link rewrite only
// needs the membership predicate.
vi.mock('utils/Buckets', () => ({
  useIsInStack: () => (bucket: string) => bucket === 'in-stack-bucket',
}))

// The dialog's own behaviour is quiltdata/quilt#5440's to test; here, only that it opens.
vi.mock('containers/QuratorMode/Save', () => ({ default: () => 'SAVE FORM' }))

vi.mock('../../Model', async (importActual) => ({
  ...(await importActual<typeof import('../../Model')>()),
  useAssistantAPI: () => ({}),
}))

import * as Model from '../../Model'

import { ConnectorHelperLine, LastSession, Menu, MessageEvent } from './Chat'

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

const sessionsStub = (
  over: Partial<Model.Assistant.API['sessions']> = {},
): Model.Assistant.API['sessions'] => ({
  available: true,
  enabled: true,
  setEnabled: vi.fn(),
  list: [],
  currentId: null,
  open: vi.fn(),
  remove: vi.fn(),
  refresh: vi.fn(),
  switching: false,
  notice: null,
  ...over,
})

const kept = () =>
  sessionsStub({
    list: [
      {
        __typename: 'QuratorSession',
        id: 's1',
        title: 'Find my packages',
        updatedAt: new Date(),
        eventCount: 2,
        package: null,
      },
    ],
  })

describe('components/Assistant/UI/Chat/LastSession', () => {
  afterEach(cleanup)

  const state = (events: unknown[]) =>
    ({ _tag: 'Idle', events }) as unknown as Model.Assistant.API['state']

  it('offers the latest session in an empty chat, and opens it on continue', () => {
    const sessions = kept()
    render(<LastSession sessions={sessions} state={state([])} />)
    expect(screen.getByText(/Last session: Find my packages/)).toBeTruthy()
    fireEvent.click(screen.getByText('continue'))
    expect(sessions.open).toHaveBeenCalledWith('s1')
  })

  it('shows the exact time on hover', () => {
    const updatedAt = new Date('2026-10-06T12:00:00Z')
    const sessions = sessionsStub({
      list: [
        {
          __typename: 'QuratorSession',
          id: 's1',
          title: 't',
          updatedAt,
          eventCount: 1,
          package: null,
        },
      ],
    })
    render(<LastSession sessions={sessions} state={state([])} />)
    expect(screen.getByTitle(updatedAt.toLocaleString())).toBeTruthy()
  })

  it('says when the session is saved as a package, timed by its last save', () => {
    const updatedAt = new Date('2026-10-06T12:00:00Z')
    const revisedAt = new Date('2026-10-06T12:00:01Z')
    const sessions = sessionsStub({
      list: [
        {
          ...kept().list[0],
          updatedAt,
          package: { __typename: 'QuratorSessionPackage', revisedAt },
        },
      ],
    })
    render(<LastSession sessions={sessions} state={state([])} />)
    expect(screen.getByText(/Saved as package/)).toBeTruthy()
    expect(screen.getByTitle(updatedAt.toLocaleString())).toBeTruthy()
  })

  it('does not say so while the package trails the last save', () => {
    const updatedAt = new Date('2026-10-06T12:00:01Z')
    const revisedAt = new Date('2026-10-06T12:00:00Z')
    const sessions = sessionsStub({
      list: [
        {
          ...kept().list[0],
          updatedAt,
          package: { __typename: 'QuratorSessionPackage', revisedAt },
        },
      ],
    })
    render(<LastSession sessions={sessions} state={state([])} />)
    expect(screen.queryByText(/Saved as package/)).toBeNull()
    expect(screen.getByTitle(updatedAt.toLocaleString())).toBeTruthy()
  })

  it('never offers the session already on screen', () => {
    const sessions = { ...kept(), currentId: 's1' }
    render(<LastSession sessions={sessions} state={state([])} />)
    expect(screen.queryByText(/Last session/)).toBeNull()
  })

  it('stays out of a chat already under way', () => {
    render(<LastSession sessions={kept()} state={state([{ id: '1' }])} />)
    expect(screen.queryByText(/Last session/)).toBeNull()
  })
})

describe('components/Assistant/UI/Chat/Menu', () => {
  afterEach(cleanup)

  const idle = { _tag: 'Idle', events: [] } as unknown as Model.Assistant.API['state']

  function renderMenu(
    devToolsOpen: boolean,
    onToggleDevTools = vi.fn(),
    sessions = sessionsStub(),
    state = idle,
  ) {
    render(
      <Menu
        state={state}
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

  it('turns kept sessions off and on from the menu', () => {
    const sessions = kept()
    renderMenu(false, vi.fn(), sessions)
    fireEvent.click(screen.getByLabelText('Qurator menu'))
    fireEvent.click(screen.getByText('Keep sessions'))
    expect(sessions.setEnabled).toHaveBeenCalledWith(false)
  })

  it('shows no session controls on a stack that does not keep them', () => {
    renderMenu(false, vi.fn(), sessionsStub({ available: false }))
    fireEvent.click(screen.getByLabelText('Qurator menu'))
    expect(screen.queryByText('Keep sessions')).toBeNull()
  })

  it('opens a recent session', () => {
    const sessions = kept()
    renderMenu(false, vi.fn(), sessions)
    fireEvent.click(screen.getByLabelText('Qurator menu'))
    fireEvent.click(screen.getByText('Find my packages'))
    expect(sessions.open).toHaveBeenCalledWith('s1')
  })

  it('deletes a recent session only once confirmed', () => {
    const sessions = kept()
    renderMenu(false, vi.fn(), sessions)
    fireEvent.click(screen.getByLabelText('Qurator menu'))
    fireEvent.click(screen.getByLabelText('Delete session: Find my packages'))
    expect(sessions.open).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Cancel'))
    expect(sessions.remove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('Qurator menu'))
    fireEvent.keyDown(screen.getByRole('menuitem', { name: /Find my packages/ }), {
      key: 'Delete',
    })
    fireEvent.click(screen.getByText('Delete'))
    expect(sessions.remove).toHaveBeenCalledWith('s1')
  })

  it('says which recent sessions are saved as packages', () => {
    const updatedAt = new Date('2026-10-06T12:00:00Z')
    const revisedAt = new Date('2026-10-06T12:00:01Z')
    const sessions = kept()
    renderMenu(false, vi.fn(), {
      ...sessions,
      list: [
        {
          ...sessions.list[0],
          updatedAt,
          package: { __typename: 'QuratorSessionPackage', revisedAt },
        },
      ],
    })
    fireEvent.click(screen.getByLabelText('Qurator menu'))
    expect(screen.getByText(/Saved as package/)).toBeTruthy()
    expect(screen.getByTitle(updatedAt.toLocaleString())).toBeTruthy()
  })

  it('opens Save to a bucket for the conversation on screen', async () => {
    const chatting = {
      _tag: 'Idle',
      events: [{ id: '1' }],
    } as unknown as Model.Assistant.API['state']
    renderMenu(false, vi.fn(), sessionsStub(), chatting)
    fireEvent.click(screen.getByLabelText('Qurator menu'))
    fireEvent.click(screen.getByText('Save to a bucket…'))
    expect(await screen.findByText('SAVE FORM')).toBeTruthy()
  })

  it('offers no Save to a bucket for an empty chat', () => {
    renderMenu(false)
    fireEvent.click(screen.getByLabelText('Qurator menu'))
    expect(
      screen
        .getByRole('menuitem', { name: 'Save to a bucket…' })
        .getAttribute('aria-disabled'),
    ).toBe('true')
  })

  it('CONTROL: offers Developer Tools while it is closed', () => {
    renderMenu(false)
    fireEvent.click(screen.getByLabelText('Qurator menu'))
    expect(screen.getByText('Developer Tools')).toBeTruthy()
  })
})
