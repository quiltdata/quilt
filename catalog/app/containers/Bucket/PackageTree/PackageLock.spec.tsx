import * as React from 'react'
import * as M from '@material-ui/core'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

import * as style from 'constants/style'

import * as PackageLock from './PackageLock'

const { lock, unlock } = vi.hoisted(() => ({ lock: vi.fn(), unlock: vi.fn() }))

vi.mock('utils/GraphQL', () => ({
  useMutation: (doc: any) =>
    doc.definitions[0].selectionSet.selections[0].name.value === 'packageLock'
      ? lock
      : unlock,
}))

const HASH = 'a'.repeat(64)

const mount = (el: React.ReactElement) =>
  render(<M.MuiThemeProvider theme={style.appTheme}>{el}</M.MuiThemeProvider>)

describe('containers/Bucket/PackageTree/PackageLock', () => {
  it('locks the given hash with a trimmed reason and closes', async () => {
    lock.mockResolvedValueOnce({ packageLock: { __typename: 'PackageLock' } })
    const onClose = vi.fn()
    const dialog = mount(
      <PackageLock.Dialog
        action="lock"
        bucket="b"
        name="team/ds"
        hash={HASH}
        onClose={onClose}
      />,
    )
    fireEvent.change(dialog.getByLabelText('Reason (optional)'), {
      target: { value: ' release ' },
    })
    fireEvent.click(dialog.getByRole('button', { name: 'Lock' }))
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(lock).toHaveBeenCalledWith({
      bucket: 'b',
      name: 'team/ds',
      hash: HASH,
      reason: 'release',
    })
  })

  it('explains a moved latest in plain words and stays open', async () => {
    lock.mockResolvedValueOnce({
      packageLock: { __typename: 'OperationError', name: 'LatestMoved', message: 'x' },
    })
    const onClose = vi.fn()
    const dialog = mount(
      <PackageLock.Dialog
        action="lock"
        bucket="b"
        name="team/ds"
        hash={HASH}
        onClose={onClose}
      />,
    )
    fireEvent.click(dialog.getByRole('button', { name: 'Lock' }))
    await dialog.findByText(/A new revision was pushed since this page loaded/)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('unlocks', async () => {
    unlock.mockResolvedValueOnce({ packageUnlock: { __typename: 'Ok' } })
    const onClose = vi.fn()
    const dialog = mount(
      <PackageLock.Dialog action="unlock" bucket="b" name="team/ds" onClose={onClose} />,
    )
    fireEvent.click(dialog.getByRole('button', { name: 'Unlock' }))
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(unlock).toHaveBeenCalledWith({ bucket: 'b', name: 'team/ds' })
  })
})
