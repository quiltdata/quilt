import * as React from 'react'
import { render } from '@testing-library/react'
import { act, renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import type * as PackageLock from 'utils/PackageLock'

const { open, close, location, dialog } = vi.hoisted(() => ({
  open: vi.fn(),
  close: vi.fn(),
  location: { search: '' },
  dialog: { real: false },
}))

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('../PackageDialog', async () => {
  const R = await import('react')
  const { useFiles } = await import('../PackageDialog/State/files')
  const FORM = { _tag: 'ready' }
  const SCHEMA = { _tag: 'idle' }
  const MANIFEST = { _tag: 'ready' as const }
  return {
    FromPhysicalKeys: (value: Record<string, string>) => ({ _tag: 'urls', value }),
    useCreateDialog: () => {
      // The real form's files state, opened the way Create's `open` sets it.
      const [opened, setOpened] = R.useState<boolean | Record<string, unknown>>(false)
      const files = useFiles(FORM as never, SCHEMA as never, MANIFEST, opened as never)
      const realOpen = R.useCallback(({ files: f }: { files?: any } = {}) => {
        open()
        setOpened(f ? { ...f.value } : true)
      }, [])
      return dialog.real ? { open: realOpen, close, files } : { open, close }
    },
  }
})
vi.mock('utils/NamedRoutes', async () => ({
  ...(await vi.importActual('utils/NamedRoutes')),
  use: () => ({ paths: { bucketPackageAddFiles: '/add' }, urls: {} }),
}))
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useHistory: () => ({ push: vi.fn() }),
  useLocation: () => location,
  useRouteMatch: () => ({}),
}))

const handle = { bucket: 'b', name: 'team/ds', hash: 'h' }

describe('containers/Bucket/PackageTree/useCreateDialog', () => {
  let useCreateDialog: typeof import('./PackageTree').useCreateDialog

  beforeEach(async () => {
    vi.clearAllMocks()
    location.search = ''
    dialog.real = false
    useCreateDialog = (await import('./PackageTree')).useCreateDialog
  })

  const mount = (lock: PackageLock.Status) =>
    renderHook(({ s }) => useCreateDialog(handle, s), { initialProps: { s: lock } })

  it('opens the add-files dialog on an unlocked package', () => {
    mount('unlocked')
    expect(open).toHaveBeenCalled()
  })

  it('neither opens nor closes while the lock loads, then opens once unlocked', () => {
    const { rerender } = mount('loading')
    expect(open).not.toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
    rerender({ s: 'unlocked' })
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('does not open on a locked package, and says it is locked', () => {
    const { result } = mount('locked')
    expect(open).not.toHaveBeenCalled()
    const { container } = render(<>{result.current.notice}</>)
    expect(container.textContent).toMatch(/This package is locked/)
  })

  it('shows no locked notice on an unlocked package', () => {
    expect(mount('unlocked').result.current.notice).toBeNull()
  })

  it('keeps an open dialog, and what was typed, when a lock arrives', () => {
    const { rerender } = mount('unlocked')
    expect(open).toHaveBeenCalledTimes(1)
    rerender({ s: 'locked' })
    expect(close).not.toHaveBeenCalled()
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('keeps edited files when the lock goes locked and back to unlocked', () => {
    dialog.real = true
    location.search = '?a.txt=s3://b/a.txt'
    const { result, rerender } = mount('unlocked')
    const files = () => (result.current as any).files
    expect(Object.keys(files().value.added)).toEqual(['a.txt'])
    act(() => files().onChange({ added: { 'edited.txt': {} } }))
    rerender({ s: 'locked' })
    rerender({ s: 'unlocked' })
    expect(open).toHaveBeenCalledTimes(1)
    expect(Object.keys(files().value.added)).toEqual(['edited.txt'])
  })

  it('opens again for a new entry to the route', () => {
    const { rerender } = mount('unlocked')
    location.search = '?b.txt=s3://b/b.txt'
    rerender({ s: 'unlocked' })
    expect(open).toHaveBeenCalledTimes(2)
  })
})
