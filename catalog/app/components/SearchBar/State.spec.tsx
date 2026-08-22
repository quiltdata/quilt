import { renderHook, act } from '@testing-library/react-hooks'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import useSearchState from './State'

const { push, assist, suggestionState, quratorState } = vi.hoisted(() => ({
  push: vi.fn(),
  assist: vi.fn(),
  // The dropdown's own state, mutable so a test can put the user on a specific
  // row. `item` is what Enter commits -- see the mock below.
  suggestionState: { selected: 0, qurator: false },
  // mutable so a test can turn the assistant off for the stack
  quratorState: { enabled: true, available: true },
}))

vi.mock('react-router-dom', () => ({
  useHistory: () => ({ push }),
}))

// Stand-in for the real suggestions model: a list plus a selected index, with
// `item` derived from the two. The classifier lives in that model now (it
// decides whether the Qurator row is in the list at all), so `qurator` here
// stands for "the model put the Qurator row first"; Suggestions/model.spec.tsx
// covers when that actually happens.
vi.mock('./Suggestions/model', () => ({
  use: (value: string, _context: unknown, quratorEnabled: boolean) => {
    const searchItems = [
      { kind: 'search', key: 'a', url: `/search?q=${encodeURIComponent(value)}` },
      { kind: 'search', key: 'b', url: `/search?q=${encodeURIComponent(value)}&t=o` },
      { kind: 'search', key: 'c', url: `/search?q=${encodeURIComponent(value)}&all` },
    ]
    const items =
      quratorEnabled && suggestionState.qurator
        ? [{ kind: 'qurator', key: 'q', query: value.trim() }, ...searchItems]
        : searchItems
    return {
      cycleSelected: () => {},
      item: items[suggestionState.selected],
      items,
      selected: suggestionState.selected,
      setSelected: () => {},
    }
  },
}))

// The real module graph reaches config/Athena at import time; the bar only
// needs the two hooks.
vi.mock('components/Assistant', () => ({
  Model: {
    useIsEnabled: () => quratorState.enabled,
    useAssistant: () => (quratorState.available ? assist : null),
  },
}))

type Context = Parameters<typeof useSearchState>[0]

const makeModel = (searchString: string | null) =>
  ({
    state: { searchString },
    actions: { setSearchString: vi.fn() },
  }) as unknown as Exclude<NonNullable<Context>, string>

const changeEvent = (value: string) =>
  ({ target: { value } }) as React.ChangeEvent<HTMLInputElement>

const enterEvent = () =>
  ({
    key: 'Enter',
    preventDefault: vi.fn(),
    currentTarget: { blur: vi.fn() },
  }) as unknown as React.KeyboardEvent<HTMLInputElement>

const setup = (context: Context) =>
  renderHook((props: { context: Context }) => useSearchState(props.context), {
    initialProps: { context },
  })

describe('components/SearchBar/State', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  })

  afterEach(() => {
    vi.useRealTimers()
    push.mockClear()
    assist.mockClear()
    suggestionState.selected = 0
    suggestionState.qurator = false
    quratorState.enabled = true
    quratorState.available = true
  })

  describe('without a search model (seed & navigate mode)', () => {
    it('starts empty and keeps typed value locally', () => {
      const { result } = setup(null)
      expect(result.current.input.value).toBe('')
      act(() => result.current.input.onChange!(changeEvent('foo')))
      expect(result.current.input.value).toBe('foo')
    })

    it('on submit: pushes the suggestion URL, clears and blurs', () => {
      const { result } = setup(null)
      act(() => result.current.input.onChange!(changeEvent('foo')))
      const evt = enterEvent()
      act(() => result.current.input.onKeyDown!(evt))
      expect(push).toHaveBeenCalledWith('/search?q=foo')
      expect(result.current.input.value).toBe('')
      expect(evt.currentTarget.blur).toHaveBeenCalled()
    })

    it('opens help on focus', () => {
      const { result } = setup(null)
      expect(result.current.input.onFocus).toBeDefined()
      act(() => result.current.input.onFocus!({} as React.FocusEvent<HTMLInputElement>))
      expect(result.current.helpOpen).toBe(true)
    })
  })

  describe('bound to a search model (the search page)', () => {
    it('initializes from the URL-held search string', () => {
      const { result } = setup(makeModel('initial'))
      expect(result.current.input.value).toBe('initial')
    })

    it('typing updates the value immediately and the model debounced', () => {
      const model = makeModel(null)
      const { result } = setup(model)
      act(() => result.current.input.onChange!(changeEvent('foo')))
      expect(result.current.input.value).toBe('foo')
      expect(model.actions.setSearchString).not.toHaveBeenCalled()
      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(model.actions.setSearchString).toHaveBeenCalledWith('foo')
    })

    it('reflects external changes of the search string into the input', () => {
      const { result, rerender } = setup(makeModel('one'))
      expect(result.current.input.value).toBe('one')
      rerender({ context: makeModel('two') })
      expect(result.current.input.value).toBe('two')
    })

    it('on submit: pushes the suggestion URL, keeps value and focus, drops pending update', () => {
      const model = makeModel(null)
      const { result } = setup(model)
      act(() => result.current.input.onChange!(changeEvent('foo')))
      const evt = enterEvent()
      act(() => result.current.input.onKeyDown!(evt))
      expect(push).toHaveBeenCalledWith('/search?q=foo')
      expect(result.current.input.value).toBe('foo')
      expect(evt.currentTarget.blur).not.toHaveBeenCalled()
      // the pending debounced model update is superseded by the pushed URL
      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(model.actions.setSearchString).not.toHaveBeenCalled()
    })

    it('does not open help on focus (the input is autofocused on mount)', () => {
      const { result } = setup(makeModel(null))
      expect(result.current.input.onFocus).toBeUndefined()
    })
  })

  // Enter commits the row the dropdown shows as selected -- never a destination
  // the user can't see. What the classifier thinks is expressed by which rows
  // exist (Suggestions/model.spec.tsx), not by overriding the selection here.
  describe('submit commits the selected row', () => {
    const submit = (query: string, context: Context = null) => {
      const { result } = setup(context)
      act(() => result.current.input.onChange!(changeEvent(query)))
      act(() => result.current.input.onKeyDown!(enterEvent()))
    }

    it('sends the Qurator row to the assistant, not to search', () => {
      suggestionState.qurator = true
      submit('what is in this bucket')
      expect(assist).toHaveBeenCalledWith('what is in this bucket')
      expect(push).not.toHaveBeenCalled()
    })

    it('sends a search row to search', () => {
      submit('drugbank')
      expect(push).toHaveBeenCalledWith('/search?q=drugbank')
      expect(assist).not.toHaveBeenCalled()
    })

    it('sends the Qurator row to the assistant on the search page too', () => {
      suggestionState.qurator = true
      submit('what is in this bucket', makeModel(null))
      expect(assist).toHaveBeenCalledWith('what is in this bucket')
      expect(push).not.toHaveBeenCalled()
    })

    it('honours a search row the user arrowed to, past a leading Qurator row', () => {
      suggestionState.qurator = true
      suggestionState.selected = 2
      submit('what is in this bucket')
      expect(push).toHaveBeenCalledWith('/search?q=what%20is%20in%20this%20bucket&t=o')
      expect(assist).not.toHaveBeenCalled()
    })

    it('offers no Qurator row when the assistant is disabled for the stack', () => {
      quratorState.enabled = false
      suggestionState.qurator = true
      const { result } = setup(null)
      act(() => result.current.input.onChange!(changeEvent('what is in this bucket')))
      expect(result.current.suggestions.items.map((i) => i.kind)).not.toContain('qurator')
      act(() => result.current.input.onKeyDown!(enterEvent()))
      expect(push).toHaveBeenCalled()
      expect(assist).not.toHaveBeenCalled()
    })

    it('offers no Qurator row when there is no assistant entrypoint', () => {
      quratorState.available = false
      suggestionState.qurator = true
      const { result } = setup(null)
      act(() => result.current.input.onChange!(changeEvent('what is in this bucket')))
      expect(result.current.suggestions.items.map((i) => i.kind)).not.toContain('qurator')
      expect(result.current.onAsk).toBeNull()
      act(() => result.current.input.onKeyDown!(enterEvent()))
      expect(push).toHaveBeenCalled()
      expect(assist).not.toHaveBeenCalled()
    })
  })

  describe('onAsk (clicking the Qurator row)', () => {
    it('runs the same commit as Enter and closes the dropdown', () => {
      const { result } = setup(null)
      act(() => result.current.input.onChange!(changeEvent('what is in this bucket')))
      act(() => result.current.onAsk!('what is in this bucket'))
      expect(assist).toHaveBeenCalledWith('what is in this bucket')
      expect(result.current.helpOpen).toBe(false)
    })

    it('drops a pending debounced model update, like Enter does', () => {
      const model = makeModel(null)
      const { result } = setup(model)
      act(() => result.current.input.onChange!(changeEvent('what is in here')))
      act(() => result.current.onAsk!('what is in here'))
      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(model.actions.setSearchString).not.toHaveBeenCalled()
    })
  })
})
