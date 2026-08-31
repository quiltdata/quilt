import * as React from 'react'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import * as SearchUIModel from '../model'

import { AvailablePackagesMetaFilters } from './PackageFilters'

vi.mock('constants/config', () => ({ default: {} }))

function renderFilters() {
  return render(
    <AvailablePackagesMetaFilters
      filtering={SearchUIModel.FacetsFilteringState.Disabled()}
      facets={{
        available: [],
        visible: SearchUIModel.EMPTY_FACET_TREE,
        hidden: SearchUIModel.EMPTY_FACET_TREE,
      }}
      ordering={{
        value: SearchUIModel.DEFAULT_FACET_ORDERING,
        set: vi.fn(),
        offered: true,
      }}
      fetching={false}
    />,
  )
}

describe('containers/Search/Layout/PackageFilters', () => {
  afterEach(cleanup)

  describe('the accessible name', () => {
    // Both halves, the way `QuerySelect` asserts them: an `aria-labelledby`
    // reaching the focusable display node overrides that node's contents, so
    // naming it after the caption alone is as lossy as not naming it at all.
    it('carries the label and the selected ordering', () => {
      renderFilters()
      expect(screen.queryByRole('button', { name: 'Sort by: Name A → Z' })).not.toBeNull()
    })

    it('names the popup listbox too', () => {
      renderFilters()
      fireEvent.mouseDown(screen.getByRole('button'))
      expect(screen.queryByRole('listbox', { name: 'Sort by:' })).not.toBeNull()
    })
  })
})
