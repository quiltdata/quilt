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
    // The exact name, not a substring: the caption alone matches /Sort by/ too,
    // so a loosened assertion passes on wiring that drops the ordering.
    it('carries the label and the selected ordering', () => {
      renderFilters()
      expect(screen.getByRole('button', { name: 'Sort by: Name A → Z' })).toBeTruthy()
    })

    it('names the popup listbox too', () => {
      renderFilters()
      fireEvent.mouseDown(screen.getByRole('button'))
      expect(screen.getByRole('listbox', { name: 'Sort by:' })).toBeTruthy()
    })
  })
})
