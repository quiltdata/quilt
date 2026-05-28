import * as React from 'react'
import { renderHook } from '@testing-library/react-hooks'
import { MemoryRouter, Route } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { BucketContextProvider, useBucketContext } from './context'

describe('containers/Bucket/context', () => {
  it('resolves bucket name from the route', () => {
    const wrapper = ({ children }: React.PropsWithChildren<{}>) => (
      <MemoryRouter initialEntries={['/b/test-bucket']}>
        <Route path="/b/:bucket">
          <BucketContextProvider>{children}</BucketContextProvider>
        </Route>
      </MemoryRouter>
    )

    const { result } = renderHook(() => useBucketContext(), { wrapper })

    expect(result.current).toStrictEqual({ name: 'test-bucket', config: {} })
  })

  it('uses explicit bucket config when provided', () => {
    const wrapper = ({ children }: React.PropsWithChildren<{}>) => (
      <MemoryRouter>
        <BucketContextProvider bucket="test-bucket" config={{ region: 'us-west-2' }}>
          {children}
        </BucketContextProvider>
      </MemoryRouter>
    )

    const { result } = renderHook(() => useBucketContext(), { wrapper })

    expect(result.current).toStrictEqual({
      name: 'test-bucket',
      config: { region: 'us-west-2' },
    })
  })
})
