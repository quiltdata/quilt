import * as React from 'react'
import { MemoryRouter, Route } from 'react-router-dom'
import { render, cleanup, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import { bucketDir } from 'constants/routes'
import * as NamedRoutes from 'utils/NamedRoutes'

import FallbackToDir from './FallbackToDir'

vi.mock('constants/config', () => ({ default: {} }))

const denied = (code: string) =>
  Promise.reject(Object.assign(new Error(), { code, statusCode: 403 }))

const listing = vi.hoisted(() => ({
  result: (): Promise<unknown> => Promise.resolve({}),
}))

// A denied HeadObject: no body, so the SDK derives code `Forbidden` from the status.
vi.mock('utils/AWS', () => {
  const s3 = {
    headObject: () => ({ promise: () => denied('Forbidden') }),
    listObjectsV2: () => ({ promise: () => listing.result() }),
  }
  return { S3: { use: () => s3 } }
})

function renderFallback() {
  return render(
    <MemoryRouter>
      <NamedRoutes.Provider routes={{ bucketDir }}>
        <FallbackToDir handle={{ bucket: 'test-bucket', key: 'restricted' }}>
          <div data-testid="file-page" />
        </FallbackToDir>
        <Route
          path={bucketDir.path}
          render={({ location }) => <div data-testid="dir">{location.pathname}</div>}
        />
      </NamedRoutes.Provider>
    </MemoryRouter>,
  )
}

describe('containers/Bucket/FallbackToDir', () => {
  afterEach(cleanup)

  it('hands a denied head to the File page when the listing is denied too', async () => {
    listing.result = () => denied('AccessDenied')
    const { getByTestId } = renderFallback()
    await waitFor(() => expect(getByTestId('file-page')).toBeTruthy())
  })

  it('surfaces a listing failure other than a denial after a denied head', async () => {
    listing.result = () => Promise.reject(new Error('Network Failure'))
    const { findByText, queryByTestId } = renderFallback()
    expect(await findByText(/not configured for Quilt/)).toBeTruthy()
    expect(queryByTestId('file-page')).toBeNull()
  })

  it('redirects a denied head to the folder when the prefix lists', async () => {
    listing.result = () =>
      Promise.resolve({ Contents: [{ Key: 'restricted/a.csv' }], CommonPrefixes: [] })
    const { getByTestId } = renderFallback()
    await waitFor(() =>
      expect(getByTestId('dir').textContent).toBe('/b/test-bucket/tree/restricted/'),
    )
  })
})
