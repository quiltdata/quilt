import { renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi } from 'vitest'

import { useNameExistence } from './name'

interface QueryState {
  data?: unknown
  error?: Error
  fetching?: boolean
}

let queryState: QueryState = {}

vi.mock('constants/config', () => ({ default: { registryUrl: '' } }))

// Mirrors the real fold's precedence: data wins over error when both are present
// (see utils/GraphQL/wrappers.ts).
vi.mock('utils/GraphQL', () => ({
  useQuery: () => queryState,
  fold: (
    result: QueryState,
    handlers: {
      data: (d: unknown, r: QueryState) => unknown
      fetching: (r: QueryState) => unknown
      error: (e: Error, r: QueryState) => unknown
    },
  ) => {
    if (result.fetching) return handlers.fetching(result)
    if (result.data) return handlers.data(result.data, result)
    if (result.error) return handlers.error(result.error, result)
    return handlers.fetching(result)
  },
}))

const dst = { bucket: 'b', name: 'some/package' }

const run = () => renderHook(() => useNameExistence(dst)).result.current

describe('containers/Bucket/PackageDialog/State/name', () => {
  describe('useNameExistence', () => {
    it('reports a name with no package behind it as new', () => {
      queryState = { data: { package: null } }
      expect(run()._tag).toBe('new')
    })

    it('reports a name that resolves to a package as existing', () => {
      queryState = { data: { package: { __typename: 'Package', name: 'some/package' } } }
      expect(run()._tag).toBe('exists')
    })

    it('does not report a name as new when the check itself failed', () => {
      // "new" is what permits publishing while a source manifest is unavailable, so an
      // unconfirmed absence must not look like a confirmed one. A partial response
      // nulls the field and reports the error alongside it.
      queryState = { data: { package: null }, error: new Error('resolver failed') }
      expect(run()._tag).not.toBe('new')
    })

    it('does not report a name as new when revalidation failed over cached data', () => {
      queryState = {
        data: { package: null },
        error: new Error('network error while revalidating'),
      }
      expect(run()._tag).toBe('error')
    })
  })
})
