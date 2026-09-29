import * as React from 'react'
import { act, fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RoleDeleteResult } from 'model/graphql/types.generated'

const notify = vi.fn()
vi.mock('containers/Notifications', () => ({ use: () => ({ push: notify }) }))

// `useMutation` unwraps the payload for its callers, so the fake resolves to the
// data directly rather than to a urql result. Reject to exercise the catch.
let roleDelete: RoleDeleteResult['__typename'] | Error
vi.mock('utils/GraphQL', async (importOriginal) => ({
  ...(await importOriginal<typeof import('utils/GraphQL')>()),
  useMutation: () => async () => {
    if (roleDelete instanceof Error) throw roleDelete
    return { roleDelete: { __typename: roleDelete } }
  },
}))

// `constants/config` reads window.QUILT_CATALOG_CONFIG at module load, so without
// this the suite fails to import at all. Same stub DataProducts.spec uses.
vi.mock('constants/config', () => ({ default: {} }))

import { Delete } from './Roles'

const role = { id: 'r1', name: 'curators' } as React.ComponentProps<typeof Delete>['role']

async function confirmDelete() {
  const { getByText } = render(<Delete role={role} close={() => {}} />)
  await act(async () => {
    fireEvent.click(getByText('Delete'))
  })
}

beforeEach(() => {
  notify.mockClear()
  // Leaving this set would let a test that forgets to assign inherit the
  // previous case's result instead of failing.
  roleDelete = undefined as never
})

describe('containers/Admin/UsersAndRoles/Roles', () => {
  describe('deleting a role', () => {
    it('names data products as the blocker when the role owns them', async () => {
      roleDelete = 'RoleOwnsDataProducts'
      await confirmDelete()
      expect(notify).toHaveBeenCalledWith("Can't delete a role that owns data products")
    })

    it('distinguishes that refusal from the other reasons a delete is refused', async () => {
      roleDelete = 'RoleAssigned'
      await confirmDelete()
      expect(notify).toHaveBeenCalledWith(expect.stringContaining('Unassign this role'))
    })

    it('says nothing when the delete succeeds', async () => {
      roleDelete = 'RoleDeleteSuccess'
      await confirmDelete()
      expect(notify).not.toHaveBeenCalled()
    })

    it('still reports something when the mutation itself fails', async () => {
      roleDelete = new Error('network down')
      await confirmDelete()
      expect(notify).toHaveBeenCalledWith('Error deleting role "curators"')
    })
  })
})
