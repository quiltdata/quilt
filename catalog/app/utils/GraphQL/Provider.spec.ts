import { describe, it, expect, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))

import { handlePackageCreation, handlePackageLock } from './Provider'

describe('utils/GraphQL/Provider', () => {
  describe('handlePackageCreation', () => {
    it('refreshes the latest revision of the pushed package', () => {
      const cache = {
        inspectFields: () => [],
        invalidate: vi.fn(),
        link: vi.fn(),
        resolve: () => null,
      }
      handlePackageCreation(
        { __typename: 'PackagePushSuccess', package: { bucket: 'b', name: 'team/ds' } },
        cache as never,
      )
      expect(cache.invalidate).toHaveBeenCalledWith(
        { __typename: 'Package', bucket: 'b', name: 'team/ds' },
        'revision',
        { hashOrTag: 'latest' },
      )
    })
  })

  describe('handlePackageLock', () => {
    const vars = { bucket: 'b', name: 'team/ds' }
    const pkg = { __typename: 'Package', bucket: 'b', name: 'team/ds' }

    it.each([
      ['a new lock', { __typename: 'PackageLock' }],
      ['an existing lock', { __typename: 'OperationError', name: 'PackageLocked' }],
    ])('refreshes the cached lock after %s', (_label, result) => {
      const cache = { invalidate: vi.fn() }
      handlePackageLock(result, vars, cache)
      expect(cache.invalidate).toHaveBeenCalledWith(pkg, 'lock')
    })

    it('leaves the cache alone on other errors', () => {
      const cache = { invalidate: vi.fn() }
      handlePackageLock(
        { __typename: 'OperationError', name: 'LatestMoved' },
        vars,
        cache,
      )
      expect(cache.invalidate).not.toHaveBeenCalled()
    })
  })
})
