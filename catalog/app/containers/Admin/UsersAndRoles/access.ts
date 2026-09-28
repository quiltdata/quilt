import * as R from 'ramda'

import * as Model from 'model'

import { RoleSelectionFragment as Role } from './gql/RoleSelection.generated'

type Level = Model.GQLTypes.BucketPermissionLevel

const RANK: Record<Level, number> = {
  [Model.GQLTypes.BucketPermissionLevel.READ]: 0,
  [Model.GQLTypes.BucketPermissionLevel.READ_WRITE]: 1,
}

export const LEVEL_LABEL: Record<Level, string> = {
  [Model.GQLTypes.BucketPermissionLevel.READ]: 'Read',
  [Model.GQLTypes.BucketPermissionLevel.READ_WRITE]: 'Read and write',
}

export const higher = (a: Level, b: Level): Level => (RANK[b] > RANK[a] ? b : a)

/** One policy's contribution to a bucket's level. */
export interface Source {
  policyId: string
  title: string
  level: Level
  /** The role the policy was reached through; set only for access spanning roles. */
  roleName?: string
}

export interface Grant {
  bucket: string
  /** The level in force: the highest any source grants. */
  level: Level
  /** Empty when nothing visible accounts for the level — see `roleAccess`. */
  sources: Source[]
}

const byBucketName = (a: Grant, b: Grant) => a.bucket.localeCompare(b.bucket)

// The server computes a role's level per bucket as MAX() across the role's policies
// (`resolve_managed_role_permissions`), so `permissions` is authoritative and the
// policies only explain it. An unmanaged policy grants through an ARN Quilt cannot
// read, so a bucket the union names may have no visible source; it keeps an empty
// `sources` rather than being dropped or attributed to a guess.
export function roleAccess(role: Role): Grant[] {
  if (role.__typename !== 'ManagedRole') return []
  const sources = new Map<string, Source[]>()
  for (const p of role.policies) {
    for (const perm of p.permissions) {
      const list = sources.get(perm.bucket.name) ?? []
      list.push({ policyId: p.id, title: p.title, level: perm.level })
      sources.set(perm.bucket.name, list)
    }
  }
  return role.permissions
    .map((perm) => ({
      bucket: perm.bucket.name,
      level: perm.level,
      sources: R.sortBy((s: Source) => s.title, sources.get(perm.bucket.name) ?? []),
    }))
    .sort(byBucketName)
}

// A role's readout is incomplete whenever something granting access is invisible to
// Quilt, which is two cases, not one: a custom role's policies cannot be read at all,
// and a managed role's unmanaged policy grants through an ARN the API does not expose.
// Keyed off `__typename` alone this misses the second, presenting a partial list as
// complete.
export function accessIncomplete(role: Role): boolean {
  if (role.__typename !== 'ManagedRole') return true
  return role.policies.some((p) => !p.managed)
}

// Access reachable across several roles at once. A user assumes one role at a time,
// so this is only the truth for a set of roles held together, never for a user.
export function combinedAccess(roles: readonly Role[]): Grant[] {
  const byBucket = new Map<string, Grant>()
  for (const role of roles) {
    for (const g of roleAccess(role)) {
      const sources = g.sources.map((s) => ({ ...s, roleName: role.name }))
      const prev = byBucket.get(g.bucket)
      if (prev) {
        prev.level = higher(prev.level, g.level)
        prev.sources = prev.sources.concat(sources)
      } else {
        byBucket.set(g.bucket, { ...g, sources })
      }
    }
  }
  return Array.from(byBucket.values()).sort(byBucketName)
}

export interface AccessSummary {
  buckets: number
  write: number
  read: number
  /** Buckets whose level no visible policy accounts for. */
  unattributed: number
}

export function summarize(grants: readonly Grant[]): AccessSummary {
  const write = grants.filter(
    (g) => g.level === Model.GQLTypes.BucketPermissionLevel.READ_WRITE,
  ).length
  return {
    buckets: grants.length,
    write,
    read: grants.length - write,
    unattributed: grants.filter((g) => !g.sources.length).length,
  }
}
