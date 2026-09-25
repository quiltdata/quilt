import { renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi } from 'vitest'

import { getUsernamePrefix, useNameExistence } from './name'

interface QueryState {
  data?: unknown
  error?: Error
  fetching?: boolean
}

let queryState: QueryState = {}

vi.mock('constants/config', () => ({
  default: {
    registryUrl: '',
  },
}))

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))

// The real fold decides what a partial response means, so only the query is faked.
vi.mock('utils/GraphQL', async () => ({
  ...(await vi.importActual('utils/GraphQL')),
  useQuery: () => queryState,
}))

describe('containers/Bucket/PackageDialog/State/name', () => {
  describe('getUsernamePrefix', () => {
    it('should return string anyway', () => {
      expect(getUsernamePrefix()).toBe('')
      expect(getUsernamePrefix(null)).toBe('')
    })

    it('should return itself for usernames', () => {
      expect(getUsernamePrefix('username_not-an-email')).toBe('username_notanemail/')
    })

    it('should return prefix for emails', () => {
      expect(getUsernamePrefix('username@email.co.uk')).toBe('username/')
    })
  })

  describe('useNameExistence', () => {
    const run = () =>
      renderHook(() => useNameExistence({ bucket: 'b', name: 'some/package' })).result
        .current

    it('reports a name with no package behind it as new', () => {
      queryState = { data: { package: null } }
      expect(run()._tag).toBe('new')
    })

    it('reports a name that resolves to a package as existing', () => {
      queryState = { data: { package: { __typename: 'Package', name: 'some/package' } } }
      expect(run()._tag).toBe('exists')
    })

    it('withholds absence when the check itself failed', () => {
      // Loading, not an error — see name.ts for why.
      queryState = { data: { package: null }, error: new Error('resolver failed') }
      expect(run()._tag).toBe('loading')
    })

    it.each([
      ['an absence', { package: null }],
      ['a package', { package: { __typename: 'Package', name: 'other/package' } }],
    ])('withholds %s that describes the previous name', (_label, data) => {
      // What urql yields right after a variables change: the prior name's response, kept
      // while the new one is in flight.
      queryState = { data, fetching: true }
      expect(run()._tag).toBe('loading')
    })
  })
})
