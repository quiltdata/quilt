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
      // Still-loading rather than a name error, so a blip cannot block a flow with
      // nothing at risk. See the note in name.ts for why "new" is load-bearing.
      queryState = { data: { package: null }, error: new Error('resolver failed') }
      expect(run()._tag).toBe('loading')
    })
  })
})
