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
  it('reports a deletion confirmed while the package is not known unlocked', async () => {
    const onDeleted = vi.fn()
    const { result } = renderHook(() => usePackageDeletion(handle, 'locked', onDeleted))
    act(() => result.current.confirmDelete())
    await act(() => result.current.handlePackageDeletion())
    expect(mutate).not.toHaveBeenCalled()
    expect(onDeleted).not.toHaveBeenCalled()
    expect(result.current.deletionState).toMatchObject({
      error: 'This package is locked',
      loading: false,
      opened: true,
    })
  })
})
