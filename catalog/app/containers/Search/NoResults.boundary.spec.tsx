import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { search } from 'constants/routes'
import * as NamedRoutes from 'utils/NamedRoutes'

vi.mock('constants/config', () => ({ default: {}, registryUrl: '' }))

// Skeletons only, and they drag in notebook CSS through the renderer tree.
// Irrelevant to what this spec guards.
vi.mock('./List/Hit', () => ({
  PackageSkeleton: () => null,
  ObjectSkeleton: () => null,
}))
vi.mock('./Table/Skeleton', () => ({ Table: () => null }))

import * as NoResults from './NoResults'

// What the search error boundaries in Search/Search.tsx and
// Bucket/PackageList.tsx depend on: their fallback renders *outside*
// SearchUIModel.Provider, because the Provider is what threw. A boundary does
// not catch what its own fallback throws, so the moment this screen reads the
// model the containment silently becomes a blank page again.
const Boundary = ({ children }: React.PropsWithChildren<{}>) => (
  <ErrorBoundary
    FallbackComponent={({ error }: FallbackProps) => (
      <span>ESCAPED: {error.message}</span>
    )}
  >
    {children}
  </ErrorBoundary>
)

describe('containers/Search/NoResults.Error outside the model provider', () => {
  afterEach(cleanup)

  it('renders with no SearchUIModel.Provider above it', () => {
    const { getByText, queryByText } = render(
      <MemoryRouter>
        <NamedRoutes.Provider routes={{ search }}>
          <Boundary>
            <NoResults.Error onRefine={() => {}}>
              Invalid date range in the search URL
            </NoResults.Error>
          </Boundary>
        </NamedRoutes.Provider>
      </MemoryRouter>,
    )

    expect(getByText('Unexpected error')).toBeTruthy()
    // the thrown message reaches the screen, which is the whole point
    expect(getByText('Invalid date range in the search URL')).toBeTruthy()
    // and it got there without tripping the boundary
    expect(queryByText(/^ESCAPED:/)).toBeNull()
  })
})
