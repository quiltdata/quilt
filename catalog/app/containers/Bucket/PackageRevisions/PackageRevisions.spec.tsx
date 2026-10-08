import * as React from 'react'
import * as M from '@material-ui/core'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/react'

import * as style from 'constants/style'

import { PackageRevisions } from './PackageRevisions'

const { useLock } = vi.hoisted(() => ({ useLock: vi.fn() }))

vi.mock('constants/config', () => ({ default: {} }))
vi.mock('react-redux', () => ({ useSelector: () => true }))
vi.mock('utils/PackageLock', async () => ({
  useDialog: (
    await vi.importActual<typeof import('utils/PackageLock')>('utils/PackageLock')
  ).useDialog,
  useLock,
  usePrefs: (s: unknown) => s,
}))
vi.mock('utils/BucketPreferences', () => ({ Result: { match: () => null } }))
vi.mock('utils/GraphQL', () => ({
  useQuery: () => ({ fetching: true }),
  useMutation: () => vi.fn(),
  fold: () => null,
}))
vi.mock('utils/NamedRoutes', () => ({
  use: () => ({
    urls: { bucketPackageDetail: () => '/', bucketPackageRevisions: () => '/' },
  }),
}))
vi.mock('../PackageDialog', () => ({ useCreateDialog: () => ({ render: () => null }) }))

const pageEl = () => (
  <M.MuiThemeProvider theme={style.appTheme}>
    <MemoryRouter>
      <PackageRevisions bucket="b" name="team/ds" />
    </MemoryRouter>
  </M.MuiThemeProvider>
)

const mount = () => render(pageEl())

const locked = {
  status: 'locked',
  lock: { hash: 'h'.repeat(64), lockedAt: new Date(), lockedBy: 'a', reason: null },
}

describe('containers/Bucket/PackageRevisions', () => {
  it('shows the lock notice, with Unlock for an admin', () => {
    useLock.mockReturnValue({
      status: 'locked',
      lock: { hash: 'h'.repeat(64), lockedAt: new Date(), lockedBy: 'a', reason: null },
    })
    const page = mount()
    expect(page.getByText('Locked')).toBeTruthy()
    expect(page.getByText('Unlock')).toBeTruthy()
  })

  it('closes the Unlock dialog once the package reads unlocked', async () => {
    useLock.mockReturnValue(locked)
    const view = mount()
    fireEvent.click(view.getByText('Unlock'))
    expect(view.queryByRole('dialog')).not.toBeNull()
    useLock.mockReturnValue({ status: 'unlocked', lock: null })
    view.rerender(pageEl())
    await waitFor(() => expect(view.queryByRole('dialog')).toBeNull())
  })

  it('shows no notice on an unlocked package', () => {
    useLock.mockReturnValue({ status: 'unlocked', lock: null })
    expect(mount().queryByText('Locked')).toBeNull()
  })
})
