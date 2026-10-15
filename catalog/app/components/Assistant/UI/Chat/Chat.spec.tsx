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

// Stands in for the app's Router and NamedRoutes providers, at `location.path`.
const location = vi.hoisted(() => ({ path: '/' }))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    Link: ({ to, ...props }: { to: string }) => <a href={to} {...props} />,
    useRouteMatch: (opts: object) => actual.matchPath(location.path, opts),
  }
})
vi.mock('utils/NamedRoutes', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  use: () => ({
    paths: { qurator: '/qurator', quratorMode: '/qurator-mode' },
    urls: { qurator: () => '/qurator' },
  }),
}))

import * as Model from '../../Model'

import type { ToolCallGroupIds } from './Chat'
import {
  ConnectorHelperLine,
  Menu,
  MessageEvent,
  ToolCallGroup,
  advancePendingRound,
  roundKeyOf,
  toolCallGroupIdsOf,
  toolCallRunsOf,
  toolTitle,
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

describe('components/Assistant/UI/Chat/roundKeyOf', () => {
  const live = (ids: readonly string[]) => ({ anchor: undefined, ids })
  const settled = (anchor: string, ids: readonly string[]) => ({ anchor, ids })

  it('has no round key when nothing has resolved one and the round has no anchor', () => {
    expect(roundKeyOf(undefined, live(['a', 'b']))).toBeUndefined()
  })

  it("falls back to the group's own anchor when the caller resolved no key", () => {
    expect(roundKeyOf(undefined, settled('event-a', ['a', 'b']))).toBe('event-a')
  })

  // The whole reason a resolved key exists: a round first seen live is
  // minted its own key, and once its first call resolves, that key must
  // go on being the round's permanent identity -- not be displaced by the
  // anchor that's now available. The caller (`advancePendingRound`)
  // decides when a resolved key applies; this function just has to prefer
  // it over the anchor whenever one is given.
  it('prefers an explicitly resolved key over the anchor, even once the round is settled', () => {
    expect(roundKeyOf('pending-1', settled('event-a', ['a', 'b']))).toBe('pending-1')
  })
})

// This is the logic that took three review rounds to get right: a round
// first seen live has no anchor yet, so it needs a key minted up front;
// once its first call resolves, that *same* key must survive the
// transition rather than being displaced by the new anchor (a changed key
// remounts the round, dropping any focus inside it); and a *different*
// round reusing a toolUseId, or a *later* live round after this one has
// fully settled, must never resolve through the stale pending slot.
describe('components/Assistant/UI/Chat/advancePendingRound', () => {
  const live = (ids: readonly string[]) => ({ anchor: undefined, ids })
  const settled = (anchor: string, ids: readonly string[]) => ({ anchor, ids })
  let nextKey = 0
  const mintKey = () => `minted-${nextKey++}`

  beforeEach(() => {
    nextKey = 0
  })

  it('mints a key for a round first seen live', () => {
    const pending = advancePendingRound(undefined, [live(['a'])], mintKey)
    expect(pending).toEqual({ anchor: undefined, key: 'minted-0' })
  })

  it('keeps minting the same key across renders while still live', () => {
    let pending = advancePendingRound(undefined, [live(['a'])], mintKey)
    pending = advancePendingRound(pending, [live(['a', 'b'])], mintKey)
    expect(pending).toEqual({ anchor: undefined, key: 'minted-0' })
  })

  // The bug `b85a3aca7` fixed, and the bug my first fix for it
  // reintroduced: the pending round's key must survive its own anchor
  // appearing, not be replaced by it.
  it("keeps the pending round's own key once its first call resolves", () => {
    let pending = advancePendingRound(undefined, [live(['a'])], mintKey)
    pending = advancePendingRound(pending, [settled('event-a', ['a'])], mintKey)
    expect(pending).toEqual({ anchor: 'event-a', key: 'minted-0' })
  })

  // React compares keys between *consecutive* renders, not against the
  // original pre-transition value -- so the claim must stay in force on
  // every render after the transition too, not just the one render where
  // it happens, or a later render switching to the anchor would still
  // remount the round at that point instead.
  it('keeps resolving the claimed anchor to the same key on later renders', () => {
    let pending = advancePendingRound(undefined, [live(['a'])], mintKey)
    pending = advancePendingRound(pending, [settled('event-a', ['a'])], mintKey)
    pending = advancePendingRound(pending, [settled('event-a', ['a', 'b'])], mintKey)
    expect(pending).toEqual({ anchor: 'event-a', key: 'minted-0' })
  })

  // The bug this pins: once this round is fully settled and gone from the
  // trailing position (a new Ask started a fresh round), the claim must
  // be dropped -- or a later live round reusing a toolUseId this round
  // once had would find a stale pending slot that isn't its own.
  it('drops the claim once a different round becomes trailing', () => {
    let pending = advancePendingRound(undefined, [live(['a'])], mintKey)
    pending = advancePendingRound(pending, [settled('event-a', ['a'])], mintKey)
    // A new Ask: the old round is still in history, but a fresh live round
    // (not the one this slot was tracking) is now the trailing group --
    // `toolCallGroupIdsOf` never produces more than one anchorless group
    // per call, so this is the only shape a "different round" can take.
    pending = advancePendingRound(
      pending,
      [settled('event-a', ['a']), live(['b'])],
      mintKey,
    )
    expect(pending).toEqual({ anchor: undefined, key: 'minted-1' })
  })

  it('stays empty once the round is fully discarded away before ever settling', () => {
    let pending = advancePendingRound(undefined, [live(['a'])], mintKey)
    pending = advancePendingRound(pending, [], mintKey)
    expect(pending).toBeUndefined()
  })

  // Composition check: this is exactly the two-line sequence Chat's own
  // render body runs every render (advancePendingRound to update the ref,
  // then roundKeyOf per group to get the React key) -- unit-tested here
  // without mounting the whole component, closing the gap the ToolCallGroup
  // focus test below can't reach (it rerenders ToolCallGroup directly with
  // `expanded` held constant by its caller, so it never exercises Chat's
  // own key computation that decides whether ToolCallGroup remounts at all).
  it("gives Chat's own per-render key computation the same key across a round's live-to-history transition", () => {
    let pending: ReturnType<typeof advancePendingRound>
    const keyForRenderOf = (group: ToolCallGroupIds) => {
      pending = advancePendingRound(pending, [group], mintKey)
      const resolved = group.anchor === pending?.anchor ? pending?.key : undefined
      return roundKeyOf(resolved, group)
    }

    const liveOnlyKey = keyForRenderOf(live(['reused-id']))
    const mergedIntoHistoryKey = keyForRenderOf(settled('event-a', ['reused-id']))
    // The key must not change on the one render where the transition
    // happens (that's what would remount the round and drop its focus).
    expect(mergedIntoHistoryKey).toBe(liveOnlyKey)

    // The claim stays in force on every later render too, not just the one
    // transition render -- React compares keys between *consecutive*
    // renders, so switching to the anchor on some later render would still
    // remount it, even though the transition itself is long past.
    const laterRenderKey = keyForRenderOf(settled('event-a', ['reused-id', 'id-2']))
    expect(laterRenderKey).toBe(mergedIntoHistoryKey)
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
    const groups = toolCallGroupIdsOf(toolCallRuns, {
      calls: { 'use-2': { name: 'object_read', input: {}, fiber: {} as any } },
    })
    expect(groups).toEqual([{ anchor: 't1', ids: ['use-1', 'use-2'] }])
  })

  // The bug this pins: two different, Message-separated runs can carry
  // the same toolUseId (the model only guarantees uniqueness within one
  // response). Each group's anchor must still distinguish them -- it's
  // the run's own first event id, never shared across runs.
  it('gives two runs that share a toolUseId different anchors', () => {
    const toolCallRuns = [
      [toolUseEventFor('event-1', 'reused-id')],
      [messageEventFor('m1')],
      [toolUseEventFor('event-2', 'reused-id')],
    ]
    const groups = toolCallGroupIdsOf(toolCallRuns, undefined)
    expect(groups).toEqual([
      { anchor: 'event-1', ids: ['reused-id'] },
      { anchor: 'event-2', ids: ['reused-id'] },
    ])
    expect(groups[0].anchor).not.toBe(groups[1].anchor)
  })
})

describe('components/Assistant/UI/Chat/toolCallRunsOf', () => {
  const TS = new Date()

  function toolUseEventFor(id: string, toolUseId: string): Model.Conversation.Event {
    return {
      _tag: 'ToolUse',
      id,
      timestamp: TS,
      toolUseId,
      name: 'search_packages',
      input: {},
      result: { status: 'success', content: [] },
    }
  }

  function messageEventFor(id: string, discarded?: boolean): Model.Conversation.Event {
    return {
      _tag: 'Message',
      id,
      discarded,
      timestamp: TS,
      role: 'assistant',
      content: Model.Content.MessageContentBlock.Text({ text: 'ok' }),
    }
  }

  // The bug this pins: filtering discarded events out of the stream before
  // grouping it erases a discarded Message's run boundary along with the
  // Message itself, so the ToolUse runs on either side of it wrongly merge
  // into one. Grouping must run on the raw stream first, with discards
  // dropped from the resulting runs afterward.
  it('keeps two ToolUse runs separate across a discarded Message between them', () => {
    const runs = toolCallRunsOf([
      toolUseEventFor('1', 'use-1'),
      messageEventFor('m1', true),
      toolUseEventFor('2', 'use-2'),
    ])
    expect(runs).toEqual([
      [toolUseEventFor('1', 'use-1')],
      [toolUseEventFor('2', 'use-2')],
    ])
  })

  it('still merges adjacent ToolUse events with no Message between them', () => {
    const runs = toolCallRunsOf([
      toolUseEventFor('1', 'use-1'),
      toolUseEventFor('2', 'use-2'),
    ])
    expect(runs).toEqual([[toolUseEventFor('1', 'use-1'), toolUseEventFor('2', 'use-2')]])
  })

  it('drops a discarded ToolUse from its run without dropping the run', () => {
    const discardedCall = { ...toolUseEventFor('1', 'use-1'), discarded: true }
    const runs = toolCallRunsOf([discardedCall, toolUseEventFor('2', 'use-2')])
    expect(runs).toEqual([[toolUseEventFor('2', 'use-2')]])
  })

  it('drops a run that becomes empty once its only event is discarded', () => {
    const runs = toolCallRunsOf([
      toolUseEventFor('1', 'use-1'),
      messageEventFor('m1', true),
      toolUseEventFor('2', 'use-2'),
    ])
    expect(runs).toHaveLength(2)
    expect(runs.some((run) => run.length === 0)).toBe(false)
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
    return render(<ToolCallGroup dispatch={vi.fn()} {...props} />)
  }

  // One call carries nothing a rollup would summarize, so it stays as the
  // plain per-call row (matches today's single-tool-call rendering).
  it('renders a single call as a plain row, not a rollup', () => {
    renderGroup({ state: 'Idle', events: [toolUseEvent('1', 'search_packages')] })
    expect(screen.getByText('search packages')).toBeTruthy()
    expect(screen.queryByText(/tool calls/)).toBeNull()
  })

  // ToolCallRollup's single-call branch (ToolMessage) and multi-call branch
  // are different subtrees; the toggle must live above both so it survives
  // a group growing from one call to two.
  it('keeps a call expanded after a second call joins its group', () => {
    const { rerender } = render(
      <ToolCallGroup
        dispatch={vi.fn()}
        state="Idle"
        events={[toolUseEvent('1', 'search_packages')]}
      />,
    )
    const toggle = () =>
      screen.getAllByRole('button').find((b) => b.hasAttribute('aria-expanded'))!
    fireEvent.click(toggle())
    expect(toggle().getAttribute('aria-expanded')).toBe('true')

    rerender(
      <ToolCallGroup
        dispatch={vi.fn()}
        state="Idle"
        events={[toolUseEvent('1', 'search_packages'), toolUseEvent('2', 'object_read')]}
      />,
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
    expect(screen.getByText('Running: package revision')).toBeTruthy()
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
    expect(screen.getByText('search packages')).toBeTruthy()
    expect(screen.getByText('object read')).toBeTruthy()
  })

  // Each finished call keeps its own discard control once expanded, not just
  // when it's the sole call rendered as a plain row.
  it('offers a discard action for each finished call once expanded', () => {
    const dispatch = vi.fn()
    render(
      <ToolCallGroup
        dispatch={dispatch}
        state="Idle"
        events={[toolUseEvent('1', 'search_packages'), toolUseEvent('2', 'object_read')]}
      />,
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

  it('offers the full page from the panel', () => {
    location.path = '/'
    renderMenu(false)
    fireEvent.click(screen.getByLabelText('Qurator menu'))
    expect(screen.getByText('Open full page').closest('a')?.getAttribute('href')).toBe(
      '/qurator',
    )
  })

  it('does not offer the full page on the full page', () => {
    location.path = '/qurator/'
    renderMenu(false)
    fireEvent.click(screen.getByLabelText('Qurator menu'))
    expect(screen.queryByText('Open full page')).toBeNull()
  })

  it('does not offer the full page inside Qurator mode', () => {
    location.path = '/qurator-mode'
    renderMenu(false)
    fireEvent.click(screen.getByLabelText('Qurator menu'))
    expect(screen.queryByText('Open full page')).toBeNull()
  })
})

describe('components/Assistant/UI/Chat/ToolCallGroup approval', () => {
  afterEach(cleanup)

  it('names tools without the connector prefix', () => {
    expect(toolTitle('platform__s3_object_put')).toBe('s3 object put')
    expect(toolTitle('navigate')).toBe('navigate')
  })

  // A call awaiting approval never joins the rollup: it needs the user's
  // direct attention as its own card, not a collapsed "Running" summary.
  it('asks before a pending write and dispatches the answer', () => {
    const dispatch = vi.fn()
    render(
      <ToolCallGroup
        dispatch={dispatch}
        state="ToolUse"
        events={[]}
        live={{
          timestamp: new Date(),
          calls: {
            w: {
              name: 'platform__object_delete',
              input: { bucket: 'b', key: 'k.txt' },
              approval: 'destructive',
              key: 'k1',
            },
          },
        }}
      />,
    )
    expect(screen.getByText(/object delete/)).toBeTruthy()
    expect(screen.getByText(/replace or delete existing data/)).toBeTruthy()
    expect(screen.getByText('key: k.txt')).toBeTruthy()
    // No rollup to carry the abort action, since the only live call is
    // awaiting approval -- the approval card offers it instead.
    expect(screen.getByText('abort')).toBeTruthy()

    fireEvent.click(screen.getByText('Run'))
    expect(dispatch).toHaveBeenCalledWith(
      Model.Conversation.Action.Approve({ id: 'w', key: 'k1' }),
    )
    fireEvent.click(screen.getByText("Don't run"))
    expect(dispatch).toHaveBeenCalledWith(
      Model.Conversation.Action.Deny({ id: 'w', key: 'k1' }),
    )
  })

  // A finished call makes the rollup render alongside the approval card, but
  // it isn't running, so it offers no abort of its own -- the approval card
  // must still carry it, or the turn becomes uncancellable.
  it('still offers abort when a finished call sits beside a pending approval', () => {
    render(
      <ToolCallGroup
        dispatch={vi.fn()}
        state="ToolUse"
        events={[
          {
            _tag: 'ToolUse',
            id: '1',
            timestamp: new Date(),
            toolUseId: '1-use',
            name: 'search_packages',
            input: {},
            result: { status: 'success', content: [] },
          },
        ]}
        live={{
          timestamp: new Date(),
          calls: {
            w: {
              name: 'platform__object_delete',
              input: { bucket: 'b', key: 'k.txt' },
              approval: 'destructive',
              key: 'k1',
            },
          },
        }}
      />,
    )
    expect(screen.getByText('abort')).toBeTruthy()
  })

  // The bug this pins: when a running read finishes while a write still
  // awaits approval, Chat used to render the standalone (live-only) and
  // merged-into-history cases at two different JSX call sites, so this
  // transition always remounted ToolCallGroup from scratch -- dropping
  // focus from whichever approval button the user had focused. One
  // ToolCallGroup instance, rerendered in place as its read's result
  // moves from `live` into `events` (same props shape Chat now produces
  // from its one unified list), must keep that focus.
  it('keeps the approval card focused when a concurrent read finishes', () => {
    const { rerender } = render(
      <ToolCallGroup
        dispatch={vi.fn()}
        state="ToolUse"
        events={[]}
        live={{
          timestamp: new Date(),
          calls: {
            w: {
              name: 'platform__object_delete',
              input: { bucket: 'b', key: 'k.txt' },
              approval: 'destructive',
              key: 'k1',
            },
            r: { name: 'search_packages', input: {}, fiber: {} as any },
          },
        }}
      />,
    )
    const runButton = screen.getByRole('button', { name: 'Run' })
    runButton.focus()
    expect(document.activeElement).toBe(runButton)

    rerender(
      <ToolCallGroup
        dispatch={vi.fn()}
        state="ToolUse"
        events={[
          {
            _tag: 'ToolUse',
            id: '1',
            timestamp: new Date(),
            toolUseId: 'r',
            name: 'search_packages',
            input: {},
            result: { status: 'success', content: [] },
          },
        ]}
        live={{
          timestamp: new Date(),
          calls: {
            w: {
              name: 'platform__object_delete',
              input: { bucket: 'b', key: 'k.txt' },
              approval: 'destructive',
              key: 'k1',
            },
          },
        }}
      />,
    )
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Run' }))
  })
})
