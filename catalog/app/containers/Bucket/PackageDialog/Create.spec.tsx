import { act, renderHook } from '@testing-library/react-hooks'
import { beforeAll, describe, it, expect, vi } from 'vitest'

const { setOpen, resolve } = vi.hoisted(() => ({
  setOpen: vi.fn(),
  resolve: { current: (() => {}) as (v: unknown) => void },
}))

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('components/Intercom', () => ({ usePauseVisibilityWhen: () => {} }))
vi.mock('../requests', () => ({
  useFilesListing: () => () =>
    new Promise((r) => {
      resolve.current = r
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
  computeDialogStatus: () => ({ _tag: 'ready' }),
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
      resolve.current({ 'a.txt': {} })
      await opening
    })
    expect(setOpen).not.toHaveBeenCalled()
  })
})
