import { describe, it, expect } from 'vitest'

import * as Model from 'model'

import { roleAccess, combinedAccess, summarize, higher, accessIncomplete } from './access'
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
            // Attached in reverse alphabetical order, so the sort is what produces the
            // listed order rather than the order they happen to arrive in.
            { id: 'p1', title: 'writers', permissions: [perm('bio', WRITE)] },
            { id: 'p2', title: 'readers', permissions: [perm('bio', READ)] },
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
      // The real shape of this: a policy set by ARN, attached and named, whose
      // permissions the API cannot report. A role with no policies at all would pass
      // this without the unmanaged case ever being exercised.
      const grants = roleAccess(
        managed(
          'via-arn',
          [perm('opaque', WRITE)],
          [{ id: 'p1', title: 'by-arn', managed: false, permissions: [] }],
        ),
      )
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

  describe('accessIncomplete', () => {
    it('reports a custom role, whose policies Quilt cannot read at all', () => {
      const role = { __typename: 'UnmanagedRole', id: 'r', name: 'x', arn: 'a' } as Role
      expect(accessIncomplete(role)).toBe(true)
    })

    it('reports a managed role holding a policy set by ARN', () => {
      // The case a `__typename` check misses: the role is managed, so the list renders
      // as complete while one attached policy grants through an ARN nothing can read.
      expect(
        accessIncomplete(
          managed(
            'mixed',
            [perm('bio', READ)],
            [
              { id: 'p1', title: 'readers', permissions: [perm('bio', READ)] },
              { id: 'p2', title: 'by-arn', managed: false, permissions: [] },
            ],
          ),
        ),
      ).toBe(true)
    })

    it('reports nothing missing when every attached policy is readable', () => {
      expect(
        accessIncomplete(
          managed(
            'plain',
            [perm('bio', READ)],
            [{ id: 'p1', title: 'readers', permissions: [perm('bio', READ)] }],
          ),
        ),
      ).toBe(false)
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
