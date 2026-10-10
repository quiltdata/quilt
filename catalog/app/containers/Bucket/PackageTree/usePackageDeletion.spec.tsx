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
  it('says the package is locked when the registry refuses the deletion for it', async () => {
    mutate.mockResolvedValueOnce({
      packageRevisionDelete: {
        __typename: 'OperationError',
        message: "Package 'team/ds' in bucket 'b' is locked",
        name: 'PackageLocked',
      },
    })
    const onDeleted = vi.fn()
    const { result } = renderHook(() => usePackageDeletion(handle, onDeleted))
    act(() => result.current.confirmDelete())
    await act(() => result.current.handlePackageDeletion())
    expect(onDeleted).not.toHaveBeenCalled()
    expect(result.current.deletionState).toMatchObject({
      error: 'This package is locked',
      loading: false,
      opened: true,
    })
  })
})
