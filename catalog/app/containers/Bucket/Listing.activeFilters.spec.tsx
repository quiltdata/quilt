import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import { ActiveFilters } from './Listing'

// `ActiveFilters` renders as tooltip content in three places in Listing.tsx and
// had no boundary above it. It used to spread a conditional JSX expression into
// an object literal:
//
//   {...(lookup[item.columnField!] && <li/>)}
//
// `columnField` is optional on GridFilterItem, so `lookup[...]` can be
// undefined; on that branch the spread produced `{}`, which is not a valid React
// element, so React threw "Objects are not valid as a React child" and blanked
// the catalog. The `!` assertions conceded the field is nullable.

vi.mock('constants/config', () => ({ default: {} }))

// The component reads three DataGrid selectors off the grid API context. Mock at
// that seam so we control exactly what shape the filter items have.
let activeFilters: unknown[] = []
let lookup: Record<string, unknown> = {}

vi.mock('components/DataGrid', async () => {
  const actual =
    await vi.importActual<typeof import('components/DataGrid')>('components/DataGrid')
  const activeGridFilterItemsSelector = Symbol('activeFilters')
  const gridColumnLookupSelector = Symbol('lookup')
  const filterGridItemsCounterSelector = Symbol('counter')
  return {
    ...actual,
    activeGridFilterItemsSelector,
    gridColumnLookupSelector,
    filterGridItemsCounterSelector,
    GridApiContext: React.createContext({
      current: {
        getLocaleText: () => (counter: number) => `${counter} active filter(s)`,
      },
    }),
    useGridSelector: (_apiRef: unknown, selector: symbol) => {
      if (selector === activeGridFilterItemsSelector) return activeFilters
      if (selector === gridColumnLookupSelector) return lookup
      if (selector === filterGridItemsCounterSelector) return activeFilters.length
      throw new Error('unexpected selector')
    },
  }
})

describe('containers/Bucket/Listing ActiveFilters', () => {
  afterEach(() => {
    cleanup()
    activeFilters = []
    lookup = {}
  })

  it('renders a row for a filter whose column is known', () => {
    activeFilters = [{ id: 1, columnField: 'size', operatorValue: '>', value: '10' }]
    lookup = { size: { headerName: 'Size' } }

    const { container, getByText } = render(<ActiveFilters />)

    const items = container.querySelectorAll('li')
    expect(items).toHaveLength(1)
    expect(getByText(/Size/)).toBeTruthy()
    expect(container.textContent).toContain('>')
    expect(container.textContent).toContain('10')
  })

  it('does not throw when columnField is missing', () => {
    // The reachable failure: a filter item with no columnField at all.
    activeFilters = [{ id: 1, operatorValue: 'contains', value: 'x' }]
    lookup = { size: { headerName: 'Size' } }

    expect(() => render(<ActiveFilters />)).not.toThrow()
  })

  it('does not throw when columnField names a column absent from the lookup', () => {
    // Equally reachable: the column was hidden/removed since the filter was set,
    // so `lookup[columnField]` is undefined.
    activeFilters = [{ id: 1, columnField: 'gone', operatorValue: '=', value: '1' }]
    lookup = { size: { headerName: 'Size' } }

    expect(() => render(<ActiveFilters />)).not.toThrow()
  })

  it('renders no rows for unmatched filters but keeps the matched ones', () => {
    activeFilters = [
      { id: 1, columnField: 'size', operatorValue: '>', value: '10' },
      { id: 2, operatorValue: 'contains', value: 'x' },
      { id: 3, columnField: 'gone', operatorValue: '=', value: '1' },
    ]
    lookup = { size: { headerName: 'Size' } }

    const { container } = render(<ActiveFilters />)

    // Only the resolvable filter becomes a row; the other two are dropped rather
    // than emitting an invalid child.
    const items = container.querySelectorAll('li')
    expect(items).toHaveLength(1)
    expect(items[0].textContent).toContain('Size')
  })

  it('falls back to the raw field name when the column has no headerName', () => {
    activeFilters = [{ id: 1, columnField: 'size', operatorValue: '>', value: '10' }]
    lookup = { size: {} }

    const { container } = render(<ActiveFilters />)

    expect(container.querySelectorAll('li')).toHaveLength(1)
    expect(container.textContent).toContain('size')
  })

  // Control, not evidence: the counter line is above the mapped list and was
  // never affected by the spread bug. Passes with or without the fix.
  it('renders the active-filter count', () => {
    activeFilters = [{ id: 1, columnField: 'size', operatorValue: '>', value: '10' }]
    lookup = { size: { headerName: 'Size' } }

    const { container } = render(<ActiveFilters />)

    expect(container.textContent).toContain('1 active filter(s)')
  })
})
