import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { renderHook } from '@testing-library/react-hooks'
import { describe, expect, it, vi } from 'vitest'

import { search } from 'constants/routes'
import * as NamedRoutes from 'utils/NamedRoutes'

vi.mock('constants/config', () => ({ default: {}, registryUrl: '' }))

// Aliased on import: called as a bare `use(...)`, the hook linter reads it as
// React's own `use()` and rejects it inside renderHook's callback.
import { use as useSuggestions } from './model'

// The dropdown is the contract: whatever row it shows as selected is what Enter
// commits (State.tsx does nothing but commit `item`). So the thing worth
// guarding here is that a query the classifier calls a question actually LEADS
// with the Qurator row -- the earlier bug was a list that said "Search ..." on
// the highlighted row while Enter opened the assistant.
const wrapper = ({ children }: { children?: React.ReactNode }) => (
  <MemoryRouter>
    <NamedRoutes.Provider routes={{ search }}>{children}</NamedRoutes.Provider>
  </MemoryRouter>
)

const setup = (query: string, quratorEnabled = true) =>
  renderHook(() => useSuggestions(query, null, quratorEnabled), { wrapper }).result
    .current

describe('components/SearchBar/Suggestions/model', () => {
  describe('a natural-language query leads with the Qurator row', () => {
    it.each([
      ['a question mark', 'drugbank?'],
      ['an interrogative prefix', 'what is in this bucket'],
      ['an imperative prefix', 'find the phase 3 studies'],
      ['five or more words', 'phase 3 studies from last quarter'],
    ])('%s', (_why, query) => {
      const { items, item } = setup(query)
      expect(items[0].kind).toBe('qurator')
      // the selected row IS the Qurator row, so Enter goes to the assistant
      expect(item).toBe(items[0])
      expect(item).toMatchObject({ kind: 'qurator', query: query.trim() })
    })

    it('keeps the search destinations below it, one arrow-press away', () => {
      const { items } = setup('what is in this bucket')
      expect(items.slice(1).map((i) => i.kind)).toEqual(['search', 'search'])
    })

    it('trims the query it hands to the assistant', () => {
      const { item } = setup('  what is in this bucket  ')
      expect(item).toMatchObject({ kind: 'qurator', query: 'what is in this bucket' })
    })
  })

  describe('a keyword query offers search destinations only', () => {
    it.each([['drugbank'], ['phase 3'], ['chembl compounds']])('%s', (query) => {
      const { items, item } = setup(query)
      expect(items.map((i) => i.kind)).not.toContain('qurator')
      expect(item!.kind).toBe('search')
    })

    it('offers no Qurator row for an empty query', () => {
      const { items } = setup('')
      expect(items.map((i) => i.kind)).not.toContain('qurator')
    })
  })

  it('offers no Qurator row when the assistant is unavailable', () => {
    const { items, item } = setup('what is in this bucket', false)
    expect(items.map((i) => i.kind)).not.toContain('qurator')
    expect(item!.kind).toBe('search')
  })

  describe('selection', () => {
    it('starts on the first row', () => {
      const { selected } = setup('what is in this bucket')
      expect(selected).toBe(0)
    })

    // Typing changes the list's length (the Qurator row appears and disappears),
    // so a stale index must never leave the highlight -- and Enter -- pointing
    // past the end of the list.
    it('clamps a stale index into the shorter list', () => {
      const { result, rerender } = renderHook(
        ({ query }: { query: string }) => useSuggestions(query, null, true),
        { initialProps: { query: 'what is in this bucket' }, wrapper },
      )
      const withQurator = result.current.items.length
      result.current.cycleSelected(true) // wrap to the last row
      rerender({ query: 'drugbank' }) // Qurator row disappears
      expect(result.current.items.length).toBe(withQurator - 1)
      expect(result.current.selected).toBe(result.current.items.length - 1)
      expect(result.current.item).toBe(
        result.current.items[result.current.items.length - 1],
      )
    })
  })
})
