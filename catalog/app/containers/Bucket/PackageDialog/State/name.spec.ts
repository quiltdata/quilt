import * as React from 'react'
import { act, renderHook } from '@testing-library/react-hooks'
import { beforeEach, describe, it, expect, vi } from 'vitest'

import * as workflows from 'utils/workflows'

import { getUsernamePrefix, useName, useNameExistence } from './name'
import { useParams } from './params'
import * as Schema from './schema'
import * as Meta from './meta'

interface QueryState {
  data?: unknown
  error?: Error
  fetching?: boolean
}

let queryState: QueryState = {}
let lock = 'unlocked'

const { useLockStatus } = vi.hoisted(() => ({ useLockStatus: vi.fn() }))
vi.mock('utils/PackageLock', () => ({ useLockStatus }))

let debounced: string | undefined
vi.mock('use-debounce', () => ({
  useDebounce: (v: string) => [debounced ?? v],
}))

vi.mock('constants/config', () => ({
  default: {
    registryUrl: '',
  },
}))

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }))

vi.mock('react-redux', async () => ({
  ...(await vi.importActual('react-redux')),
  useSelector: () => 'user',
}))

const apiReq = vi.fn()
vi.mock('utils/APIConnector', () => ({ use: () => apiReq }))

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
    beforeEach(() => {
      debounced = undefined
      useLockStatus.mockImplementation(() => lock)
    })

    it('checks the lock of the debounced name and waits for it to settle', () => {
      queryState = { data: { package: null } }
      debounced = 'some/pack'
      expect(run()._tag).toBe('loading')
      expect(useLockStatus).toHaveBeenLastCalledWith('b', 'some/pack', false)
    })

    const run = () =>
      renderHook(() =>
        useNameExistence(
          { bucket: 'b', name: 'some/package' },
          debounced ?? 'some/package',
        ),
      ).result.current

    it('reports a name with no package behind it as new', () => {
      queryState = { data: { package: null } }
      expect(run()._tag).toBe('new')
    })

    it('reports a name that resolves to a package as existing', () => {
      queryState = {
        data: { package: { __typename: 'Package', name: 'some/package' } },
      }
      expect(run()._tag).toBe('exists')
    })

    it('refuses a locked destination before anything uploads', () => {
      queryState = {
        data: { package: { __typename: 'Package', name: 'some/package' } },
      }
      lock = 'locked'
      const status = run()
      lock = 'unlocked'
      expect(status).toMatchObject({
        _tag: 'error',
        error: {
          message: 'This package is locked; an admin must unlock it first',
        },
      })
    })

    it('stays loading while the lock is unknown', () => {
      queryState = { data: { package: null } }
      lock = 'loading'
      const status = run()
      lock = 'unlocked'
      expect(status._tag).toBe('loading')
    })

    it('withholds absence when the check itself failed', () => {
      // Loading, not an error — see name.ts for why.
      queryState = {
        data: { package: null },
        error: new Error('resolver failed'),
      }
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

  describe('useName', () => {
    const src = { bucket: 'b', name: 'team/ds' }

    beforeEach(() => {
      debounced = undefined
      lock = 'unlocked'
      useLockStatus.mockImplementation(() => lock)
      apiReq.mockResolvedValue({ valid: true })
      queryState = { data: { package: null } }
    })

    const mount = (initial: string) =>
      renderHook(() => {
        const [dst, setDst] = React.useState<{ bucket: string; name?: string }>({
          bucket: 'b',
          name: initial,
        })
        const name = useName({ _tag: 'idle' }, dst, setDst, src)
        const params = useParams({
          dst,
          manifest: { _tag: 'ready' },
          message: { value: 'msg', status: { _tag: 'ok' }, onChange: vi.fn() },
          meta: { value: {}, status: Meta.Ok, onChange: vi.fn() },
          metadataSchema: Schema.Ready({}),
          name,
          workflow: {
            value: { slug: 'w' } as workflows.Workflow,
            status: { _tag: 'ok' },
            onChange: vi.fn(),
          },
        })
        return { name, params }
      })

    it('cannot submit a pasted locked name before its lock resolves', async () => {
      // The name is still debouncing from an empty field, so nothing has been checked.
      debounced = ''
      const { result, rerender } = mount('')
      act(() => result.current.name.onChange('team/locked'))
      expect(result.current.name.status._tag).toBe('loading')
      expect(result.current.params._tag).toBe('invalid')

      debounced = 'team/locked'
      lock = 'locked'
      rerender()
      await act(async () => {})
      expect(result.current.name.status._tag).toBe('error')
      expect(result.current.params._tag).toBe('invalid')
    })

    it("does not wait on the debounce for the source's own name", () => {
      debounced = 'team/d'
      const { result } = mount('team/d')
      act(() => result.current.name.onChange('team/ds'))
      expect(result.current.name.status._tag).toBe('new-revision')
      expect(useLockStatus).toHaveBeenLastCalledWith('b', 'team/ds', false)
    })
  })
})
