import { act, renderHook } from '@testing-library/react-hooks'
import { beforeAll, describe, it, expect, vi } from 'vitest'

const { setOpen, resolvers, rejecters, computeDialogStatus } = vi.hoisted(() => ({
  setOpen: vi.fn(),
  resolvers: [] as ((v: unknown) => void)[],
  rejecters: [] as ((e: unknown) => void)[],
  computeDialogStatus: vi.fn<
    (s: { waitingListing: boolean; resolveError: Error | null }) => unknown
  >(() => ({
    _tag: 'ready',
  })),
}))

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('components/Intercom', () => ({ usePauseVisibilityWhen: () => {} }))
vi.mock('../requests', () => ({
  useFilesListing: () => () =>
    new Promise((resolve, reject) => {
      resolvers.push(resolve)
      rejecters.push(reject)
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

  it('lets only the newest open set files, wait or error', async () => {
    const { useCreateDialog, FromHandles } = Create
    const { result } = renderHook(() => useCreateDialog({ dst: { bucket: 'b' } }))
    const last = () => computeDialogStatus.mock.lastCall?.[0]
    let a: Promise<void> = Promise.resolve()
    let b: Promise<void> = Promise.resolve()
    act(() => {
      a = result.current.open({ files: FromHandles([]) })
    })
    const [resolveA, rejectA] = [resolvers.at(-1)!, rejecters.at(-1)!]
    act(() => {
      b = result.current.open({ files: FromHandles([]) })
    })
    const resolveB = resolvers.at(-1)!
    setOpen.mockClear()
    await act(async () => {
      rejectA(new Error('A failed'))
      await a
    })
    expect(last()).toMatchObject({ waitingListing: true, resolveError: null })
    await act(async () => {
      resolveB({ 'b.txt': {} })
      await b
    })
    resolveA({ 'a.txt': {} })
    expect(setOpen).toHaveBeenLastCalledWith({ 'b.txt': {} })
    expect(last()).toMatchObject({ waitingListing: false, resolveError: null })
  })

  it('clears an older listing error on an open without files', async () => {
    const { useCreateDialog, FromHandles } = Create
    const { result } = renderHook(() => useCreateDialog({ dst: { bucket: 'b' } }))
    let a: Promise<void> = Promise.resolve()
    act(() => {
      a = result.current.open({ files: FromHandles([]) })
    })
    await act(async () => {
      rejecters.at(-1)!(new Error('A failed'))
      await a
    })
    expect(computeDialogStatus.mock.lastCall?.[0].resolveError).not.toBeNull()
    act(() => {
      result.current.open()
    })
    expect(computeDialogStatus.mock.lastCall?.[0].resolveError).toBeNull()
  })
})
