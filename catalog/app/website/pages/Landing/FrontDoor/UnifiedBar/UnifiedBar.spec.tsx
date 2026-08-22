import * as React from 'react'
import * as M from '@material-ui/core'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as style from 'constants/style'

vi.mock('constants/config', () => ({ default: {} }))

const historyPush = vi.fn()
const useIsEnabled = vi.fn(() => true)
const assist = vi.fn()

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useHistory: () => ({ push: historyPush }),
}))

vi.mock('components/Assistant', () => ({
  Model: {
    useIsEnabled: () => useIsEnabled(),
    useAssistant: () => assist,
  },
}))

vi.mock('../useUnifiedSuggestions', () => ({ default: () => [] }))

vi.mock('utils/Buckets', () => ({ useRelevantBuckets: () => [] }))

import UnifiedBar from './UnifiedBar'

// The bar's styles read app-theme extensions (typography.monospace), so render
// under the same theme the app provides.
const renderBar = (props: React.ComponentProps<typeof UnifiedBar>) =>
  render(
    <M.MuiThemeProvider theme={style.appTheme}>
      <UnifiedBar {...props} />
    </M.MuiThemeProvider>,
  )

describe('website/pages/Landing/FrontDoor/UnifiedBar/UnifiedBar', () => {
  afterEach(() => {
    cleanup()
    historyPush.mockClear()
    assist.mockClear()
    useIsEnabled.mockReset()
    useIsEnabled.mockReturnValue(true)
  })

  it('renders without error', () => {
    const { getByLabelText } = renderBar({ value: '', onChange: vi.fn() })
    expect(getByLabelText('Search or ask Qurator')).toBeTruthy()
  })

  it('navigates to the existing search route for Search submissions', () => {
    const { getByLabelText } = renderBar({ value: 'drugbank', onChange: vi.fn() })
    fireEvent.keyDown(getByLabelText('Search or ask Qurator'), { key: 'Enter' })
    expect(historyPush).toHaveBeenCalledWith('/search?q=drugbank')
  })

  it('opens the real Assistant when the classifier routes to Qurator', () => {
    const { getByLabelText } = renderBar({
      value: 'what data exists?',
      onChange: vi.fn(),
    })
    fireEvent.keyDown(getByLabelText('Search or ask Qurator'), { key: 'Enter' })
    expect(historyPush).not.toHaveBeenCalled()
    expect(assist).toHaveBeenCalledWith('what data exists?')
  })

  it('shows the Qurator interpreted-plan panel for question queries', () => {
    const { getByText } = renderBar({ value: 'what data exists?', onChange: vi.fn() })
    expect(getByText('Run with Qurator')).toBeTruthy()
    expect(getByText(/will plan/)).toBeTruthy()
  })

  it('downgrades to plain search when "Just search instead" is clicked', () => {
    const { getByText, getByLabelText } = renderBar({
      value: 'what data exists?',
      onChange: vi.fn(),
    })
    fireEvent.click(getByText('Just search instead'))
    fireEvent.keyDown(getByLabelText('Search or ask Qurator'), { key: 'Enter' })
    expect(historyPush).toHaveBeenCalledWith('/search?q=what%20data%20exists%3F')
  })

  it('collapses to Search behavior when Qurator is disabled', () => {
    useIsEnabled.mockReturnValue(false)
    const { getByLabelText, queryByText } = renderBar({
      value: 'what data exists?',
      onChange: vi.fn(),
    })
    fireEvent.keyDown(getByLabelText('Search or ask Qurator'), { key: 'Enter' })
    expect(historyPush).toHaveBeenCalledWith('/search?q=what%20data%20exists%3F')
    expect(queryByText('Qurator')).toBeNull()
  })

  // The bar owns the suggestions list below it, so it has to say so: which list,
  // whether it's showing, and which row the arrow keys have highlighted. Before
  // this the highlight did not exist at all -- Enter always ran the bar's own
  // route, so the rows were mouse-only. These assert the chain end to end: each
  // announced id resolves to a real element, and the row the field names is the
  // row Enter actually commits.
  const field = (r: ReturnType<typeof renderBar>) =>
    r.getByLabelText('Search or ask Qurator')

  it('reports the popup closed while there are no rows to show', () => {
    const r = renderBar({ value: '', onChange: vi.fn() })
    const input = field(r)
    expect(input.getAttribute('role')).toBe('combobox')
    expect(input.getAttribute('aria-autocomplete')).toBe('list')
    expect(input.getAttribute('aria-expanded')).toBe('false')
    // Naming a highlighted row here would strand the AT cursor on an element
    // that isn't rendered.
    expect(input.getAttribute('aria-activedescendant')).toBeNull()
  })

  it('points aria-controls at a real listbox once rows are on screen', () => {
    const r = renderBar({ value: 'drugbank', onChange: vi.fn() })
    const input = field(r)
    expect(input.getAttribute('aria-expanded')).toBe('true')
    const listId = input.getAttribute('aria-controls')!
    expect(listId).toBeTruthy()
    const list = document.getElementById(listId)
    expect(list).toBeTruthy()
    expect(list!.getAttribute('role')).toBe('listbox')
    // Three scopes plus the ask-Qurator row; suggestions are mocked empty.
    expect(list!.querySelectorAll('[role="option"]')).toHaveLength(4)
    // Nothing is highlighted until the user arrows in, so Enter still belongs to
    // the bar's own route.
    expect(input.getAttribute('aria-activedescendant')).toBeNull()
  })

  it('names the arrowed-to row, and that row is the one marked selected', () => {
    const r = renderBar({ value: 'drugbank', onChange: vi.fn() })
    const input = field(r)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const activeId = input.getAttribute('aria-activedescendant')!
    expect(activeId).toBeTruthy()
    // The id the field announces has to resolve -- this is the lockstep between
    // UnifiedBar's `suggestionOptionId` call and the ids the list renders.
    const active = document.getElementById(activeId)
    expect(active).toBeTruthy()
    expect(active!.getAttribute('role')).toBe('option')
    expect(active!.getAttribute('aria-selected')).toBe('true')
    const options = Array.from(
      document
        .getElementById(input.getAttribute('aria-controls')!)!
        .querySelectorAll('[role="option"]'),
    )
    // Two ArrowDowns from rest is index 1, not merely *some* option: an
    // off-by-one here announces a different destination than Enter commits.
    expect(options.indexOf(active!)).toBe(1)
    expect(
      options.filter((o) => o.getAttribute('aria-selected') === 'true'),
    ).toHaveLength(1)
  })

  it('commits the highlighted row on Enter instead of the bar route', () => {
    const r = renderBar({ value: 'drugbank', onChange: vi.fn() })
    const input = field(r)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    // Row 1 is the objects scope, which carries `&t=o`. The bar's own Search
    // route pushes the bare query, so this distinguishes the two paths rather
    // than passing on a URL both would produce.
    expect(historyPush).toHaveBeenCalledWith('/search?q=drugbank&t=o')
  })

  it('wraps ArrowUp to the last row and runs that row own action', () => {
    const r = renderBar({ value: 'drugbank', onChange: vi.fn() })
    const input = field(r)
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    fireEvent.keyDown(input, { key: 'Enter' })
    // Last row is "Ask Qurator instead" -- a different destination entirely, so
    // this proves the highlight drives activation and that ArrowUp wraps.
    expect(assist).toHaveBeenCalledWith('drugbank')
    expect(historyPush).not.toHaveBeenCalled()
  })

  it('Escape drops the highlight first and clears the query only after', () => {
    const onChange = vi.fn()
    const r = renderBar({ value: 'drugbank', onChange })
    const input = field(r)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).toBeTruthy()
    fireEvent.keyDown(input, { key: 'Escape' })
    // First Escape gives up the highlight; wiping the query the user typed in
    // the same keystroke would destroy work they did not ask to lose.
    expect(input.getAttribute('aria-activedescendant')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('drops a stale highlight when the query changes under it', () => {
    // Controlled input: re-render with a shorter query the way the page would.
    const r = renderBar({ value: 'drugbank', onChange: vi.fn() })
    const input = field(r)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input.getAttribute('aria-activedescendant')).toBeTruthy()
    fireEvent.change(input, { target: { value: 'drug' } })
    // The row under index 0 after the edit is not the row that was highlighted
    // before it, so pointing at it would announce the wrong destination.
    expect(input.getAttribute('aria-activedescendant')).toBeNull()
  })
})
