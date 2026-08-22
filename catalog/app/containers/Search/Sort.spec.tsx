import * as React from 'react'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import Sort from './Sort'

// Keep the real Button/Menu/MenuItem so the selected-item highlight is the
// component's own, not a stub's — that highlight is what this spec asserts on.
// Only the breakpoint query is stubbed, since jsdom has no matchMedia.
vi.mock('@material-ui/core', async () => ({
  ...(await vi.importActual('@material-ui/core')),
  useMediaQuery: () => false,
}))

vi.mock('utils/GraphQL', () => ({
  fold: (result: any, cfg: any) => {
    if (result.fetching) return cfg.fetching(result)
    if (result.error) return cfg.error(result, result)
    return cfg.data(result.data, result)
  },
}))

const PRESET_ORDERINGS = vi.hoisted(() => [
  { label: 'Best match', ordering: null },
  { label: 'Most recent first', ordering: 'sys:modified:desc' },
  { label: 'Least recent first', ordering: 'sys:modified:asc' },
  { label: 'A → Z', ordering: 'sys:name:asc' },
  { label: 'Z → A', ordering: 'sys:name:desc' },
])

const model = vi.hoisted(() => ({
  state: { resultType: 'p', ordering: null as string | null },
  actions: { setOrdering: vi.fn() },
  baseSearchQuery: {
    fetching: false,
    data: { searchPackages: { __typename: 'PackagesSearchResultSet' } },
  } as any,
}))

vi.mock('./model', () => ({
  use: () => model,
  PRESET_ORDERINGS,
  ResultType: { QuiltPackage: 'p', S3Object: 'o' },
}))

const renderSort = () => render(<Sort className="sort" />)

const openMenu = (container: HTMLElement) => {
  fireEvent.click(container.querySelector('button')!)
}

const selectedLabels = () =>
  Array.from(document.querySelectorAll('[role="menuitem"]'))
    .filter((el) => el.className.includes('Mui-selected'))
    .map((el) => el.textContent)

describe('containers/Search/Sort', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    model.state.resultType = 'p'
    model.state.ordering = null
    model.baseSearchQuery = {
      fetching: false,
      data: { searchPackages: { __typename: 'PackagesSearchResultSet' } },
    }
  })

  afterEach(cleanup)

  it('labels the button with the active preset', () => {
    model.state.ordering = 'sys:modified:desc'
    const { getByText } = renderSort()
    expect(getByText('Most recent first')).toBeTruthy()
  })

  it('offers every preset ordering', () => {
    const { container } = renderSort()
    openMenu(container)
    expect(Array.from(document.querySelectorAll('[role="menuitem"]')).length).toBe(
      PRESET_ORDERINGS.length,
    )
  })

  it('highlights the active preset in the open menu', () => {
    model.state.ordering = 'sys:name:asc'
    const { container } = renderSort()
    openMenu(container)
    expect(selectedLabels()).toEqual(['A → Z'])
  })

  it('highlights relevance when no ordering is set', () => {
    const { container } = renderSort()
    openMenu(container)
    expect(selectedLabels()).toEqual(['Best match'])
  })

  it('shows a column sort as "Column" and highlights no preset', () => {
    // A column/pointer sort set from a table header is not a preset. It must not
    // highlight "Best match", whose ordering is also null — the dropdown matches
    // options by `valueOf()` equality, so the fallback reports the live ordering.
    model.state.ordering = 'usr:/reads/count:number:asc'
    const { container, getByText } = renderSort()
    expect(getByText('Column')).toBeTruthy()
    openMenu(container)
    expect(selectedLabels()).toEqual([])
  })

  it('sets the ordering for the picked preset', () => {
    const { container, getByText } = renderSort()
    openMenu(container)
    fireEvent.click(getByText('Least recent first'))
    expect(model.actions.setOrdering).toHaveBeenCalledWith('sys:modified:asc')
  })

  it('sets a null ordering when relevance is picked', () => {
    model.state.ordering = 'sys:name:desc'
    const { container, getByText } = renderSort()
    openMenu(container)
    fireEvent.click(getByText('Best match'))
    expect(model.actions.setOrdering).toHaveBeenCalledWith(null)
  })

  it('reads the ordering off the objects result set when that is the result type', () => {
    model.state.resultType = 'o'
    model.baseSearchQuery = {
      fetching: false,
      data: { searchObjects: { __typename: 'ObjectsSearchResultSet' } },
    }
    const { container } = renderSort()
    expect(container.querySelector('button')).toBeTruthy()
  })

  it.each(['EmptySearchResultSet', 'InvalidInput', 'OperationError'])(
    'renders nothing for a %s result set',
    (__typename) => {
      model.baseSearchQuery = {
        fetching: false,
        data: { searchPackages: { __typename } },
      }
      const { container } = renderSort()
      expect(container.querySelector('button')).toBeNull()
    },
  )

  it('renders nothing while the base query is in flight', () => {
    model.baseSearchQuery = { fetching: true }
    const { container } = renderSort()
    expect(container.querySelector('button')).toBeNull()
  })

  it('renders nothing when the base query errors', () => {
    model.baseSearchQuery = { error: new Error('boom') }
    const { container } = renderSort()
    expect(container.querySelector('button')).toBeNull()
  })
})
