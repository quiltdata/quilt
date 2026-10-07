import * as React from 'react'
import * as M from '@material-ui/core'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { renderHook } from '@testing-library/react-hooks'

import * as style from 'constants/style'

import * as PackageLock from './PackageLock'
import LOCK_QUERY from './gql/Lock.generated'

const { lock, unlock, useQuery } = vi.hoisted(() => ({
  lock: vi.fn(),
  unlock: vi.fn(),
  useQuery: vi.fn(),
}))

vi.mock('utils/GraphQL', () => ({
  useQuery,
  useMutation: (doc: any) =>
    doc.definitions[0].selectionSet.selections[0].name.value === 'packageLock'
      ? lock
      : unlock,
}))

const HASH = 'a'.repeat(64)

const mount = (el: React.ReactElement) =>
  render(<M.MuiThemeProvider theme={style.appTheme}>{el}</M.MuiThemeProvider>)

describe('containers/Bucket/PackageTree/PackageLock', () => {
  it('reads a registry without locks as unlocked with nothing to lock', () => {
    useQuery.mockReturnValueOnce({ data: undefined, error: new Error('no lock field') })
    const { result } = renderHook(() => PackageLock.useLock('b', 'team/ds'))
    expect(result.current).toMatchObject({ lock: null, latestHash: undefined })
  })

  it('refreshes the latest hash from the network', () => {
    const run = vi.fn()
    useQuery.mockReturnValueOnce({ data: undefined, run })
    const { result } = renderHook(() => PackageLock.useLock('b', 'team/ds'))
    result.current.refresh()
    expect(run).toHaveBeenCalledWith({ requestPolicy: 'network-only' })
  })

  it('keys the latest revision the way the revision query does', () => {
    // Without `modified` the PackageRevision cache key differs, so a push never updates it.
    const latest = JSON.stringify(LOCK_QUERY)
    expect(latest).toMatch(/"latest".*"hash".*"modified"/)
  })

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
    const onLatestMoved = vi.fn()
    const dialog = mount(
      <PackageLock.Dialog
        action="lock"
        bucket="b"
        name="team/ds"
        hash={HASH}
        onClose={onClose}
        onLatestMoved={onLatestMoved}
      />,
    )
    fireEvent.click(dialog.getByRole('button', { name: 'Lock' }))
    await dialog.findByText(/A new revision was pushed since this dialog opened/)
    expect(onClose).not.toHaveBeenCalled()
    expect(onLatestMoved).toHaveBeenCalled()
  })

  it('shows other errors as the registry words them', async () => {
    unlock
      .mockResolvedValueOnce({
        packageUnlock: { __typename: 'OperationError', name: 'X', message: 'refused' },
      })
      .mockResolvedValueOnce({
        packageUnlock: {
          __typename: 'InvalidInput',
          errors: [{ message: 'a' }, { message: 'b' }],
        },
      })
      .mockRejectedValueOnce(new Error('offline'))
    const dialog = mount(
      <PackageLock.Dialog action="unlock" bucket="b" name="team/ds" onClose={vi.fn()} />,
    )
    for (const text of ['refused', 'a; b', 'Unexpected error: offline']) {
      fireEvent.click(dialog.getByRole('button', { name: 'Unlock' }))
      await dialog.findByText(text)
    }
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
