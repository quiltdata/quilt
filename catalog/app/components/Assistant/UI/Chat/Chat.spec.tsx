import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// The `Model` barrel transitively pulls AWS/Athena, which reads the catalog
// config at module load; stub it so the import graph evaluates under jsdom.
vi.mock('constants/config', () => ({ default: {} }))

import * as Model from '../../Model'

import { ConnectorHelperLine } from './Chat'

// `ConnectorHelperLine` is rendered inside `Input`'s `FormHelperText`, which is
// a <p>. Its output must therefore stay inline-only — a block element (<div>,
// <p>, …) there triggers React's `validateDOMNesting` warning. These tests pin
// that invariant for every state the connector helper can render.

const error: Model.Connectors.BackendError = {
  _tag: 'Transport',
  message: 'down',
  transient: true,
  retryable: true,
}

// Only `config.title` is touched on render; `retry` / `acknowledge` fire on
// click, never during render, so a bare config stub is enough.
const fakeConnector = {
  config: { title: 'Quilt Platform tools' },
} as unknown as Model.Connectors.ConnectorRuntime

const cases: ReadonlyArray<[string, Model.Connectors.ConnectorState, RegExp]> = [
  ['Connecting', Model.Connectors.ConnectorState.Connecting(), /connecting/i],
  [
    'Disconnected',
    Model.Connectors.ConnectorState.Disconnected({ retrying: true, error }),
    /reconnecting/i,
  ],
  [
    'Failed (acked)',
    Model.Connectors.ConnectorState.Failed({ error, acked: true }),
    /unavailable/i,
  ],
  [
    'Failed (unacked)',
    Model.Connectors.ConnectorState.Failed({ error, acked: false }),
    /continue without/i,
  ],
]

const BLOCK_SELECTOR = 'div, p, ul, ol, li, table, section, article, h1, h2, h3'

describe('components/Assistant/UI/Chat/ConnectorHelperLine', () => {
  afterEach(cleanup)

  it.each(cases)('renders %s inline-only inside a <p>', (_name, state, expected) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(
      <p>
        <ConnectorHelperLine connector={fakeConnector} state={state} />
      </p>,
    )

    // Sanity: it actually rendered the expected line (not a vacuous pass).
    expect(container.textContent).toMatch(expected)

    // The line must not introduce block-level elements under the <p>.
    expect(container.querySelector('p')?.querySelector(BLOCK_SELECTOR)).toBeNull()

    // And React must not have flagged invalid DOM nesting.
    const nestingWarning = consoleError.mock.calls.some((args) =>
      String(args[0]).includes('validateDOMNesting'),
    )
    expect(nestingWarning).toBe(false)

    consoleError.mockRestore()
  })

  it('renders nothing for the Ready state', () => {
    const { container } = render(
      <p>
        <ConnectorHelperLine
          connector={fakeConnector}
          state={Model.Connectors.ConnectorState.Ready({
            tools: {},
            resources: [],
          })}
        />
      </p>,
    )
    expect(container.querySelector('p')?.textContent).toBe('')
  })
})
