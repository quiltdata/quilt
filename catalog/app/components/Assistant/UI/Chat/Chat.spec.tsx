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

import {
  ConnectorHelperLine,
  Menu,
  MessageEvent,
  ToolCallGroup,
  assignRoundKeys,
  lookupExpanded,
  roundKeyOf,
  toggleExpandedEntry,
  toolCallGroupIdsOf,
} from './Chat'

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

// A round's set of toolUseIds isn't fixed: calls join as they start, leave
// `live` once resolved, and can leave `events` entirely once discarded --
// so a round's expand state must survive under a permanent key, not under
// any one toolUseId that might later vanish from its id list.
describe('components/Assistant/UI/Chat/roundKeyOf, assignRoundKeys, lookupExpanded and toggleExpandedEntry', () => {
  it('has no round key before any of its ids has been assigned one', () => {
    expect(roundKeyOf(new Map(), ['a', 'b'])).toBe('a')
  })

  it('assigns every unassigned id in a round to the same key', () => {
    const assigned = assignRoundKeys(new Map(), ['a', 'b', 'c'])
    expect(roundKeyOf(assigned, ['b'])).toBe('a')
    expect(roundKeyOf(assigned, ['c'])).toBe('a')
  })

  it('keeps a round under its original key once a new id joins it', () => {
    const assigned = assignRoundKeys(new Map([['a', 'a']]), ['a', 'b'])
    expect(roundKeyOf(assigned, ['b'])).toBe('a')
  })

  it('defaults an unknown round to collapsed', () => {
    expect(lookupExpanded(new Map(), roundKeyOf(new Map(), ['a', 'b']))).toBe(false)
  })

  it('toggles a round open under its permanent key', () => {
    const roundKeys = assignRoundKeys(new Map(), ['a', 'b'])
    const expanded = toggleExpandedEntry(new Map(), roundKeyOf(roundKeys, ['a', 'b']))
    expect(lookupExpanded(expanded, roundKeyOf(roundKeys, ['a', 'b']))).toBe(true)
  })

  // The bug this pins: expand live calls a, b, c (keyed under 'a'); once
  // all finish, discarding a drops it from the round's id list entirely --
  // the saved state must still be reachable through b or c.
  it('keeps expand state reachable after the id it was keyed under is discarded', () => {
    let roundKeys = assignRoundKeys(new Map(), ['a', 'b', 'c'])
    const expanded = toggleExpandedEntry(
      new Map(),
      roundKeyOf(roundKeys, ['a', 'b', 'c']),
    )
    expect(lookupExpanded(expanded, roundKeyOf(roundKeys, ['a', 'b', 'c']))).toBe(true)

    // 'a' discarded: assignRoundKeys is now called with only ['b', 'c'],
    // the shape a naive rebuild-from-current-ids implementation would use.
    roundKeys = assignRoundKeys(roundKeys, ['b', 'c'])
    // The 'a' -> 'a' assignment, made while all three ids were present,
    // must still be in the map -- not dropped just because 'a' is absent
    // from this call's id list.
    expect(roundKeys.get('a')).toBe('a')
    expect(lookupExpanded(expanded, roundKeyOf(roundKeys, ['b', 'c']))).toBe(true)
  })

  // The bug this pins: a call joins the round *between* toggles, so it's
  // never registered by a toggle itself -- registration must happen on
  // every observation of the round's ids (Chat does this every render),
  // or a later discard of the originally-keyed call orphans the entry.
  it('keeps expand state reachable when a call joins after the toggle, then the original id is discarded', () => {
    // Toggled while only 'a' was live.
    let roundKeys = assignRoundKeys(new Map(), ['a'])
    const expanded = toggleExpandedEntry(new Map(), roundKeyOf(roundKeys, ['a']))

    // 'b' joins the round (observed, not toggled) -- registration must
    // run here too, independent of any toggle.
    roundKeys = assignRoundKeys(roundKeys, ['a', 'b'])

    // 'a' discarded; the round is now looked up only by 'b'.
    roundKeys = assignRoundKeys(roundKeys, ['b'])
    expect(lookupExpanded(expanded, roundKeyOf(roundKeys, ['b']))).toBe(true)
  })
})

describe('components/Assistant/UI/Chat/toolCallGroupIdsOf', () => {
  function toolUseEventFor(id: string, toolUseId: string): Model.Conversation.Event {
    return {
      _tag: 'ToolUse',
      id,
      timestamp: new Date(),
      toolUseId,
      name: 'search_packages',
      input: {},
      result: { status: 'success', content: [] },
    }
  }

  function messageEventFor(id: string): Model.Conversation.Event {
    return {
      _tag: 'Message',
      id,
      timestamp: new Date(),
      role: 'assistant',
      content: Model.Content.MessageContentBlock.Text({ text: 'ok' }),
    }
  }

  // The bug this pins: computing the trailing-run flag from the array
  // *after* Message runs are filtered out compares a filtered index
  // against the unfiltered length, so a Message run ahead of the
  // trailing ToolUse run throws off the comparison and drops the live
  // ids from the group that's actually displaying them.
  it('includes live ids in the trailing ToolUse run even when a Message run precedes it', () => {
    const toolCallRuns = [[messageEventFor('m1')], [toolUseEventFor('t1', 'use-1')]]
    const ids = toolCallGroupIdsOf(toolCallRuns, {
      calls: { 'use-2': { name: 'object_read', input: {}, fiber: {} as any } },
    })
    expect(ids).toEqual([['use-1', 'use-2']])
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

  // ToolCallRollup's single-call branch (ToolMessage) and multi-call branch
  // are different subtrees; the toggle must live above both so it survives
  // a group growing from one call to two.
  it('keeps a call expanded after a second call joins its group', () => {
    const { rerender } = render(
      <ThemeProvider theme={theme}>
        <ToolCallGroup
          dispatch={vi.fn()}
          state="Idle"
          events={[toolUseEvent('1', 'search_packages')]}
        />
      </ThemeProvider>,
    )
    const toggle = () =>
      screen.getAllByRole('button').find((b) => b.hasAttribute('aria-expanded'))!
    fireEvent.click(toggle())
    expect(toggle().getAttribute('aria-expanded')).toBe('true')

    rerender(
      <ThemeProvider theme={theme}>
        <ToolCallGroup
          dispatch={vi.fn()}
          state="Idle"
          events={[
            toolUseEvent('1', 'search_packages'),
            toolUseEvent('2', 'object_read'),
          ]}
        />
      </ThemeProvider>,
    )
    expect(toggle().getAttribute('aria-expanded')).toBe('true')
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

  // Each finished call keeps its own discard control once expanded, not just
  // when it's the sole call rendered as a plain row.
  it('offers a discard action for each finished call once expanded', () => {
    const dispatch = vi.fn()
    render(
      <ThemeProvider theme={theme}>
        <ToolCallGroup
          dispatch={dispatch}
          state="Idle"
          events={[
            toolUseEvent('1', 'search_packages'),
            toolUseEvent('2', 'object_read'),
          ]}
        />
      </ThemeProvider>,
    )
    fireEvent.click(screen.getByRole('button'))
    const discards = screen.getAllByText('discard')
    expect(discards).toHaveLength(2)
    fireEvent.click(discards[0])
    expect(dispatch).toHaveBeenCalledWith(Model.Conversation.Action.Discard({ id: '1' }))
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
