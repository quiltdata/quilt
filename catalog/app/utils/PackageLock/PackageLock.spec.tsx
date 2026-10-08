import * as React from 'react'
import { renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi } from 'vitest'

import * as BucketPreferences from 'utils/BucketPreferences'

import * as PackageLock from '.'
import LOCK_QUERY from './gql/Lock.generated'
import LOCK_STATE_QUERY from './gql/LockState.generated'

const { useQuery } = vi.hoisted(() => ({ useQuery: vi.fn() }))

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('utils/GraphQL', async () => ({
  isPartial: (await vi.importActual<typeof import('utils/GraphQL')>('utils/GraphQL'))
    .isPartial,
  useQuery,
}))

const useQueryResult = (r: object) => useQuery.mockReturnValueOnce(r)

const pkg = (lock: unknown) => ({ package: { bucket: 'b', name: 'team/ds', lock } })

describe('utils/PackageLock', () => {
  describe('useLock', () => {
    const run = () => renderHook(() => PackageLock.useLock('b', 'team/ds')).result.current

    it('is loading until the lock is known', () => {
      useQuery.mockReturnValueOnce({ fetching: true })
      expect(run()).toMatchObject({ status: 'loading', lock: null })
    })

    it('is loading on the previous package while the next is in flight', () => {
      useQuery.mockReturnValueOnce({
        data: { package: { bucket: 'b', name: 'other', lock: null } },
        fetching: true,
      })
      expect(run().status).toBe('loading')
    })

    it.each([
      ['in flight', { fetching: true }],
      ['partial', { operation: { context: { meta: { cacheOutcome: 'partial' } } } }],
    ])(
      'is loading while the lock query is %s on a package another query cached',
      (_label, state) => {
        // Graphcache fills the uncached lock with null.
        useQueryResult({ data: pkg(null), ...state })
        expect(run().status).toBe('loading')
      },
    )

    it.each([
      ['unlocked', pkg(null)],
      ['locked', pkg({ hash: 'h' })],
    ])('keeps a complete stale %s result while it revalidates', (status, data) => {
      useQueryResult({ data, stale: true, fetching: true })
      expect(run().status).toBe(status)
    })

    it('is loading on a stale partial result', () => {
      useQueryResult({
        data: pkg(null),
        stale: true,
        operation: { context: { meta: { cacheOutcome: 'partial' } } },
      })
      expect(run().status).toBe('loading')
    })

    it('is loading on a stale result for another package', () => {
      useQueryResult({
        data: { package: { bucket: 'b', name: 'other', lock: null } },
        stale: true,
      })
      expect(run().status).toBe('loading')
    })

    it('reports a cached lock while the query is still in flight', () => {
      useQueryResult({ data: pkg({ hash: 'h' }), fetching: true })
      expect(run().status).toBe('locked')
    })

    it("withholds the previous package's latest hash", () => {
      useQueryResult({
        data: {
          package: { bucket: 'b', name: 'other', lock: null, latest: { hash: 'x' } },
        },
        fetching: true,
      })
      expect(run().latestHash).toBeUndefined()
    })

    it('reads a registry without locks as unlocked with nothing to lock', () => {
      useQuery.mockReturnValueOnce({ data: undefined, error: new Error('no lock field') })
      expect(run()).toMatchObject({
        status: 'unlocked',
        lock: null,
        latestHash: undefined,
      })
    })

    it('reports a lock', () => {
      useQuery.mockReturnValueOnce({ data: pkg({ hash: 'h' }) })
      expect(run()).toMatchObject({ status: 'locked', lock: { hash: 'h' } })
    })

    it('refreshes the latest hash from the network', () => {
      const r = vi.fn()
      useQuery.mockReturnValueOnce({ data: pkg(null), run: r })
      run().refresh()
      expect(r).toHaveBeenCalledWith({ requestPolicy: 'network-only' })
    })

    it('keys the latest revision the way the revision query does', () => {
      // Without `modified` the PackageRevision cache key differs, so a push never updates it.
      expect(JSON.stringify(LOCK_QUERY)).toMatch(/"latest".*"hash".*"modified"/)
    })
  })

  describe('useLockStatus', () => {
    it('asks for the lock alone, not the latest revision', () => {
      expect(JSON.stringify(LOCK_STATE_QUERY)).not.toMatch(/"latest"|"revision"/)
      useQuery.mockReturnValueOnce({ data: pkg(null) })
      const { result } = renderHook(() => PackageLock.useLockStatus('b', 'team/ds'))
      expect(result.current).toBe('unlocked')
      expect(useQuery).toHaveBeenLastCalledWith(
        LOCK_STATE_QUERY,
        { bucket: 'b', name: 'team/ds' },
        { pause: false },
      )
    })

    it('reads as unlocked when paused', () => {
      useQuery.mockReturnValueOnce({ fetching: false })
      const { result } = renderHook(() => PackageLock.useLockStatus('', '', true))
      expect(result.current).toBe('unlocked')
    })
  })

  describe('canLock', () => {
    it.each([
      ['unlocked', true],
      ['loading', false],
      ['locked', false],
    ] as const)('offers an admin locking when the package is %s: %s', (s, want) => {
      expect(PackageLock.canLock(true, s, 'h')).toBe(want)
    })

    it('offers nothing without a latest revision or to a non-admin', () => {
      expect(PackageLock.canLock(true, 'unlocked')).toBe(false)
      expect(PackageLock.canLock(false, 'unlocked', 'h')).toBe(false)
    })
  })

  describe('PrefsProvider', () => {
    const actions = {
      copyPackage: true,
      deleteRevision: true,
      revisePackage: true,
      writeFile: true,
    }
    const prefs = BucketPreferences.Result.Ok({
      ui: { actions },
    } as unknown as BucketPreferences.BucketPreferences)

    const effective = (status: PackageLock.Status) =>
      renderHook(() => BucketPreferences.use().prefs, {
        wrapper: ({ children }) => (
          <BucketPreferences.Override prefs={prefs}>
            <PackageLock.PrefsProvider status={status}>
              {children}
            </PackageLock.PrefsProvider>
          </BucketPreferences.Override>
        ),
      }).result.current

    const actionsOf = (p: BucketPreferences.Result) =>
      BucketPreferences.Result.match({ Ok: ({ ui }) => ui.actions, _: () => null }, p)

    it.each(['loading', 'locked'] as const)('turns writes off while %s', (status) => {
      expect(actionsOf(effective(status))).toEqual({
        copyPackage: true,
        deleteRevision: false,
        revisePackage: false,
        writeFile: false,
      })
    })

    it('leaves an unlocked package as configured', () => {
      expect(actionsOf(effective('unlocked'))).toEqual(actions)
    })
  })
})
