import * as React from 'react'
import { render, cleanup, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))

// `useIsInStack` normally suspends on the buckets query; the link rewrite only
// needs the membership predicate.
vi.mock('utils/Buckets', () => ({
  useIsInStack: () => (bucket: string) => bucket === 'in-stack-bucket',
}))

import * as Model from '../../Model'

import { ConnectorHelperLine, MessageEvent } from './Chat'

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
