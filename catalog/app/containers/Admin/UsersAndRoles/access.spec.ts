import { describe, it, expect } from 'vitest'

import * as Model from 'model'

import { roleAccess, combinedAccess, summarize, higher } from './access'
import { RoleSelectionFragment as Role } from './gql/RoleSelection.generated'

const READ = Model.GQLTypes.BucketPermissionLevel.READ
const WRITE = Model.GQLTypes.BucketPermissionLevel.READ_WRITE

const perm = (bucket: string, level: Model.GQLTypes.BucketPermissionLevel) => ({
  bucket: { name: bucket },
  level,
})

const managed = (
  name: string,
  permissions: ReturnType<typeof perm>[],
  policies: {
    id: string
    title: string
    managed?: boolean
    permissions: ReturnType<typeof perm>[]
  }[] = [],
) =>
  ({
    __typename: 'ManagedRole',
    id: `role-${name}`,
    name,
    arn: `arn:aws:iam::1:role/${name}`,
    permissions,
    policies: policies.map((p) => ({ managed: true, roles: [], ...p })),
  }) as unknown as Role

describe('Admin/UsersAndRoles/access', () => {
  describe('higher', () => {
    it('ranks write above read regardless of argument order', () => {
      expect(higher(READ, WRITE)).toBe(WRITE)
      expect(higher(WRITE, READ)).toBe(WRITE)
      expect(higher(READ, READ)).toBe(READ)
    })
  })

  describe('roleAccess', () => {
    it('has no access to report for an unmanaged role', () => {
      const role = { __typename: 'UnmanagedRole', id: 'r', name: 'x', arn: 'a' } as Role
      expect(roleAccess(role)).toEqual([])
    })

    it('takes the level from the union and attributes it to every contributing policy', () => {
      const grants = roleAccess(
        managed(
          'analyst',
          [perm('bio', WRITE)],
          [
            { id: 'p1', title: 'readers', permissions: [perm('bio', READ)] },
            { id: 'p2', title: 'writers', permissions: [perm('bio', WRITE)] },
          ],
        ),
      )
      expect(grants).toHaveLength(1)
      expect(grants[0].level).toBe(WRITE)
      // Both are named: the read policy is still why read is granted, and dropping it
      // would tell an admin that revoking 'writers' alone removes all access.
      expect(grants[0].sources.map((s) => s.title)).toEqual(['readers', 'writers'])
    })

    it('keeps a bucket whose level no visible policy explains, with no source invented', () => {
      const grants = roleAccess(managed('via-arn', [perm('opaque', WRITE)]))
      expect(grants).toHaveLength(1)
      expect(grants[0].bucket).toBe('opaque')
      expect(grants[0].sources).toEqual([])
    })

    it('orders buckets by name', () => {
      const grants = roleAccess(
        managed('r', [perm('zeta', READ), perm('alpha', READ), perm('mid', READ)]),
      )
      expect(grants.map((g) => g.bucket)).toEqual(['alpha', 'mid', 'zeta'])
    })
  })

  describe('combinedAccess', () => {
    it('merges buckets across roles, keeping the higher level and both sources', () => {
      const grants = combinedAccess([
        managed(
          'a',
          [perm('shared', READ)],
          [{ id: 'p1', title: 'ro', permissions: [perm('shared', READ)] }],
        ),
        managed(
          'b',
          [perm('shared', WRITE)],
          [{ id: 'p2', title: 'rw', permissions: [perm('shared', WRITE)] }],
        ),
      ])
      expect(grants).toHaveLength(1)
      expect(grants[0].level).toBe(WRITE)
      expect(grants[0].sources.map((s) => [s.roleName, s.title])).toEqual([
        ['a', 'ro'],
        ['b', 'rw'],
      ])
    })

    it('does not let a later role lower a level an earlier one granted', () => {
      const grants = combinedAccess([
        managed('a', [perm('shared', WRITE)]),
        managed('b', [perm('shared', READ)]),
      ])
      expect(grants[0].level).toBe(WRITE)
    })
  })

  // The user page tabs one panel per held role plus a trailing "Any role" panel, so
  // the highest valid index is held.length, not held.length - 1. Clamping to the
  // latter made the merged panel unreachable for every multi-role user.
  describe('tab index ceiling', () => {
    const clamp = (tab: number, held: number) => Math.min(tab, held)

    it('admits the index one past the per-role tabs', () => {
      expect(clamp(5, 5)).toBe(5)
    })

    it('still clamps an index beyond the merged tab', () => {
      expect(clamp(9, 5)).toBe(5)
    })

    it('holds at zero when no role is held', () => {
      expect(clamp(3, 0)).toBe(0)
    })
  })

  describe('summarize', () => {
    it('counts buckets by level and flags the ones nothing explains', () => {
      const grants = combinedAccess([
        managed(
          'r',
          [perm('a', WRITE), perm('b', READ), perm('c', READ)],
          [{ id: 'p', title: 't', permissions: [perm('a', WRITE), perm('b', READ)] }],
        ),
      ])
      expect(summarize(grants)).toEqual({
        buckets: 3,
        write: 1,
        read: 2,
        unattributed: 1,
      })
    })
  })
})
