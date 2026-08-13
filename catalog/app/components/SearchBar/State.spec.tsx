import { renderHook, act } from '@testing-library/react-hooks'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import useSearchState from './State'

const { push, assist, suggestionState, quratorState } = vi.hoisted(() => ({
  push: vi.fn(),
  assist: vi.fn(),
  // mutable so a test can put the user on a non-default suggestion
  suggestionState: { selected: 0 },
  // mutable so a test can turn the assistant off for the stack
  quratorState: { enabled: true, available: true },
}))

vi.mock('react-router-dom', () => ({
  useHistory: () => ({ push }),
}))

vi.mock('./Suggestions/model', () => ({
  use: (value: string) => ({
    cycleSelected: () => {},
    items: [],
    selected: suggestionState.selected,
    setSelected: () => {},
    url: `/search?q=${encodeURIComponent(value)}`,
  }),
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

  describe('Qurator routing on submit', () => {
    const submit = (query: string, context: Context = null) => {
      const { result } = setup(context)
      act(() => result.current.input.onChange!(changeEvent(query)))
      act(() => result.current.input.onKeyDown!(enterEvent()))
    }

    it('sends a natural-language query to Qurator instead of search', () => {
      submit('what is in this bucket')
      expect(assist).toHaveBeenCalledWith('what is in this bucket')
      expect(push).not.toHaveBeenCalled()
    })

    it('sends a keyword query to search', () => {
      submit('drugbank')
      expect(push).toHaveBeenCalledWith('/search?q=drugbank')
      expect(assist).not.toHaveBeenCalled()
    })

    it('routes to Qurator on the search page too', () => {
      submit('what is in this bucket', makeModel(null))
      expect(assist).toHaveBeenCalledWith('what is in this bucket')
      expect(push).not.toHaveBeenCalled()
    })

    it('honours a deliberately selected suggestion over the classifier', () => {
      suggestionState.selected = 2
      submit('what is in this bucket')
      expect(push).toHaveBeenCalledWith('/search?q=what%20is%20in%20this%20bucket')
      expect(assist).not.toHaveBeenCalled()
    })

    it('falls back to search when Qurator is disabled for the stack', () => {
      quratorState.enabled = false
      submit('what is in this bucket')
      expect(push).toHaveBeenCalled()
      expect(assist).not.toHaveBeenCalled()
    })

    it('falls back to search when there is no assistant entrypoint', () => {
      quratorState.available = false
      submit('what is in this bucket')
      expect(push).toHaveBeenCalled()
      expect(assist).not.toHaveBeenCalled()
    })
  })
})
