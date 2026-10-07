import { renderHook } from '@testing-library/react-hooks'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import type * as PackageLock from 'utils/PackageLock'

const { open, close } = vi.hoisted(() => ({ open: vi.fn(), close: vi.fn() }))

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('../PackageDialog', () => ({ useCreateDialog: () => ({ open, close }) }))
vi.mock('utils/NamedRoutes', async () => ({
  ...(await vi.importActual('utils/NamedRoutes')),
  use: () => ({ paths: { bucketPackageAddFiles: '/add' }, urls: {} }),
}))
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useHistory: () => ({ push: vi.fn() }),
  useLocation: () => ({ search: '' }),
  useRouteMatch: () => ({}),
}))

const handle = { bucket: 'b', name: 'team/ds', hash: 'h' }

describe('containers/Bucket/PackageTree/useCreateDialog', () => {
  let useCreateDialog: typeof import('./PackageTree').useCreateDialog

  beforeEach(async () => {
    vi.clearAllMocks()
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
    expect(open).toHaveBeenCalled()
  })

  it('closes on a locked package without opening', () => {
    mount('locked')
    expect(open).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalled()
  })
})
