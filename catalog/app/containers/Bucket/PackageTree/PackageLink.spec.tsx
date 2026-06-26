import * as React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'

import { bucketPackageList, bucketPackageDetail } from 'constants/routes'
import * as NamedRoutes from 'utils/NamedRoutes'
import {
  PackagesSearchFilterIO,
  ResultType,
  parseSearchParams,
} from 'containers/Search/model'

import PackageLink from './PackageLink'

// The Search model's import graph pulls in `constants/config`, which throws
// unless a catalog config is present on `window`.
vi.mock('constants/config', () => ({ default: {} }))

describe('containers/Bucket/PackageTree/PackageLink', () => {
  // The prefix link sends the user to the package list filtered to that prefix.
  // The list page reads URL filters by the search model's predicate keys and
  // silently drops unrecognized params, so the link's param must round-trip
  // through `parseSearchParams` into the `name` filter. This guards against the
  // producer/consumer drift that regressed the feature (see #5035 / #4413).
  it('prefix link round-trips to the package list `name` filter', () => {
    const { getByRole } = render(
      <MemoryRouter>
        <NamedRoutes.Provider routes={{ bucketPackageList, bucketPackageDetail }}>
          <PackageLink bucket="my-bucket" name="team/dataset" />
        </NamedRoutes.Provider>
      </MemoryRouter>,
    )

    const href = getByRole('link', { name: 'team/' }).getAttribute('href')
    expect(href).toBeTruthy()

    const state = parseSearchParams(new URL(href!, 'http://localhost').search)

    expect(state.resultType).toBe(ResultType.QuiltPackage)
    if (state.resultType !== ResultType.QuiltPackage) throw new Error('unreachable')

    expect(state.filter.predicates.name).toMatchObject({
      wildcard: 'team/',
      strict: false,
    })

    // ...and the prefix becomes a `team/*` wildcard at the GraphQL layer.
    expect(PackagesSearchFilterIO.toGQL(state.filter)?.name?.wildcard).toBe('team/*')
  })

  // The list page drops params it doesn't recognize, so the pre-fix `filter=`
  // link produced no filter at all. Pin that `filter` stays inert so a future
  // change can't silently resurrect the broken contract.
  it('drops the unrecognized legacy `filter` param', () => {
    const state = parseSearchParams('?filter=team/')
    if (state.resultType !== ResultType.QuiltPackage) throw new Error('unreachable')
    expect(state.filter.predicates.name).toBeNull()
  })
})
