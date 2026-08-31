import * as React from 'react'
import { render, cleanup, screen } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import * as KTree from 'utils/KeyedTree'

import * as SearchUIModel from '../model'

import { AvailablePackagesMetaFilters } from './PackageFilters'

vi.mock('constants/config', () => ({ default: { registryUrl: '' } }))

const EMPTY_TREE: SearchUIModel.FacetTree = KTree.Tree([])

function renderFilters() {
  return render(
    <AvailablePackagesMetaFilters
      filtering={SearchUIModel.FacetsFilteringState.Disabled()}
      facets={{ available: [], visible: EMPTY_TREE, hidden: EMPTY_TREE }}
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

  describe('the ordering control', () => {
    // MUI v4's Select spreads `inputProps` onto the aria-hidden native input,
    // not the focusable display node -- so an aria-labelledby placed there
    // names nothing, and the control reads as a bare "button" to a screen
    // reader. Same trap QuerySelect documents.
    it('names its focusable node', () => {
      renderFilters()
      expect(screen.getByRole('button', { name: /Sort by/ })).toBeDefined()
    })
  })
})
