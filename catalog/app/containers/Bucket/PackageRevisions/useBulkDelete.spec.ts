import { act, renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

import { useBulkDelete } from './useBulkDelete'

const deleteRevision: Mock = vi.fn()
vi.mock('utils/GraphQL', () => ({ useMutation: () => deleteRevision }))

const ok = { packageRevisionDelete: { __typename: 'PackageRevisionDeleteSuccess' } }
const fail = (message: string) => ({
  packageRevisionDelete: { __typename: 'OperationError', message },
})

function selecting(...hashes: string[]) {
  const { result } = renderHook(() => useBulkDelete('b', 'foo/bar'))
  act(() => hashes.forEach(result.current.toggle))
  return result
}

describe('containers/Bucket/PackageRevisions/useBulkDelete', () => {
  beforeEach(() => deleteRevision.mockReset())

  it('toggles selection off on a second click', () => {
    const result = selecting('h1', 'h2', 'h1')
    expect([...result.current.selected]).toEqual(['h2'])
  })

  it('deletes every selected revision and clears the selection', async () => {
    deleteRevision.mockResolvedValue(ok)
    const result = selecting('h1', 'h2')
    await act(() => result.current.run())
    expect(deleteRevision).toHaveBeenCalledTimes(2)
    expect([...result.current.selected]).toEqual([])
    expect(result.current.state).toMatchObject({ error: undefined, opened: false })
  })

  it('stops at the first failure and keeps the survivors selected', async () => {
    deleteRevision.mockResolvedValueOnce(ok).mockResolvedValueOnce(fail('nope'))
    const result = selecting('h1', 'h2', 'h3')
    await act(() => result.current.run())
    // h2 failed, so h3 is never attempted and both stay selected
    expect(deleteRevision).toHaveBeenCalledTimes(2)
    expect([...result.current.selected]).toEqual(['h2', 'h3'])
    expect(result.current.state.error).toContain('nope')
    expect(result.current.state.opened).toBe(true)
  })

  it('reports how many were already deleted when it stops', async () => {
    deleteRevision.mockResolvedValueOnce(ok).mockResolvedValueOnce(fail('nope'))
    const result = selecting('h1', 'h2', 'h3')
    await act(() => result.current.run())
    expect(result.current.state.error).toContain('1 already deleted')
  })

  it('drops the selection when the package changes', () => {
    const { result, rerender } = renderHook(({ name }) => useBulkDelete('b', name), {
      initialProps: { name: 'foo/bar' },
    })
    act(() => result.current.toggle('h1'))
    expect([...result.current.selected]).toEqual(['h1'])
    rerender({ name: 'foo/other' })
    expect([...result.current.selected]).toEqual([])
  })

  it('names the failing revision when the mutation throws', async () => {
    deleteRevision.mockRejectedValueOnce(new Error('offline'))
    const result = selecting('h1')
    await act(() => result.current.run())
    expect(result.current.state.error).toContain('h1')
  })
})
