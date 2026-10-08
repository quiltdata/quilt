import { act, renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi } from 'vitest'

import { usePackageDeletion } from './usePackageDeletion'

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }))

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('utils/GraphQL', async () => ({
  ...(await vi.importActual('utils/GraphQL')),
  useMutation: () => mutate,
}))

const handle = { bucket: 'b', name: 'team/ds', hash: 'h' }

describe('containers/Bucket/PackageTree/usePackageDeletion', () => {
  it.each([
    ['locked', 'This package is locked'],
    ['loading', 'Still checking whether this package is locked…'],
  ] as const)(
    'reports a deletion confirmed while the package is %s',
    async (lock, error) => {
      const onDeleted = vi.fn()
      const { result } = renderHook(() => usePackageDeletion(handle, lock, onDeleted))
      act(() => result.current.confirmDelete())
      await act(() => result.current.handlePackageDeletion())
      expect(mutate).not.toHaveBeenCalled()
      expect(onDeleted).not.toHaveBeenCalled()
      expect(result.current.deletionState).toMatchObject({
        error,
        loading: false,
        opened: true,
      })
    },
  )
})
