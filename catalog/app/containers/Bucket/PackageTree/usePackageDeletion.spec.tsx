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

  it('leaves the next package alone when a deletion resolves after navigating', async () => {
    let resolve: (v: unknown) => void = () => {}
    mutate.mockReturnValueOnce(new Promise((r) => (resolve = r)))
    const onDeleted = vi.fn()
    const { result, rerender } = renderHook((h) => usePackageDeletion(h, onDeleted), {
      initialProps: handle,
    })
    act(() => result.current.confirmDelete())
    let pending: Promise<void> = Promise.resolve()
    act(() => {
      pending = result.current.handlePackageDeletion()
    })
    rerender({ ...handle, name: 'team/other' })
    await act(async () => {
      resolve({ packageRevisionDelete: { __typename: 'PackageRevisionDeleteSuccess' } })
      await pending
    })
    expect(onDeleted).not.toHaveBeenCalled()
    expect(result.current.deletionState).toMatchObject({ loading: false, opened: false })
  })
})
