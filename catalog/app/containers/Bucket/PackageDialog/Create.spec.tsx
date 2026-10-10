import { act, renderHook } from '@testing-library/react-hooks'
import { beforeAll, describe, it, expect, vi } from 'vitest'

const { setOpen, resolvers, computeDialogStatus } = vi.hoisted(() => ({
  setOpen: vi.fn(),
  resolvers: [] as ((v: unknown) => void)[],
  computeDialogStatus: vi.fn<(s: { waitingListing: boolean }) => unknown>(() => ({
    _tag: 'ready',
  })),
}))

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('components/Intercom', () => ({ usePauseVisibilityWhen: () => {} }))
vi.mock('../requests', () => ({
  useFilesListing: () => () =>
    new Promise((r) => {
      resolvers.push(r)
    }),
}))
vi.mock('./State', () => ({
  useState: () => ({
    formStatus: { _tag: 'ready' },
    open: false,
    reset: () => {},
    setDst: () => {},
    setOpen,
  }),
  computeDialogStatus,
}))

// Imported in a hook, so the module's load counts against hookTimeout, not the test's.
let Create: typeof import('./Create')
beforeAll(async () => {
  Create = await import('./Create')
})

describe('containers/Bucket/PackageDialog/Create', () => {
  it('stays closed when a listing resolves after the dialog was closed', async () => {
    const { useCreateDialog, FromHandles } = Create
    const { result } = renderHook(() => useCreateDialog({ dst: { bucket: 'b' } }))
    let opening: Promise<void> = Promise.resolve()
    act(() => {
      opening = result.current.open({ files: FromHandles([]) })
    })
    act(() => result.current.close())
    setOpen.mockClear()
    await act(async () => {
      resolvers[resolvers.length - 1]({ 'a.txt': {} })
      await opening
    })
    expect(setOpen).not.toHaveBeenCalled()
  })

  it('keeps waiting for a newer listing when an older one resolves after close', async () => {
    const { useCreateDialog, FromHandles } = Create
    const { result } = renderHook(() => useCreateDialog({ dst: { bucket: 'b' } }))
    let first: Promise<void> = Promise.resolve()
    act(() => {
      first = result.current.open({ files: FromHandles([]) })
    })
    const older = resolvers[resolvers.length - 1]
    act(() => result.current.close())
    act(() => {
      result.current.open({ files: FromHandles([]) })
    })
    await act(async () => {
      older({ 'a.txt': {} })
      await first
    })
    expect(computeDialogStatus.mock.lastCall?.[0].waitingListing).toBe(true)
  })

  it('stops waiting when the dialog closes mid-listing', () => {
    const { useCreateDialog, FromHandles } = Create
    const { result } = renderHook(() => useCreateDialog({ dst: { bucket: 'b' } }))
    act(() => {
      result.current.open({ files: FromHandles([]) })
    })
    act(() => result.current.close())
    act(() => {
      result.current.open()
    })
    expect(computeDialogStatus.mock.lastCall?.[0].waitingListing).toBe(false)
  })
})
