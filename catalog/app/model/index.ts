import * as IO from 'io-ts'

import * as Types from 'utils/types'

import * as GQLTypes from './graphql/types.generated'

export * as GQLTypes from './graphql/types.generated'

export const BucketPermissionLevel = Types.enum(
  GQLTypes.BucketPermissionLevel,
  'BucketPermissionLevel',
)

export const BucketPermissionLevelStrings = ['None', 'Read', 'ReadWrite'] as const

export type BucketPermissionLevelString = typeof BucketPermissionLevelStrings[number]

export const NullableBucketPermissionLevelFromString = new IO.Type<
  GQLTypes.BucketPermissionLevel | null,
  BucketPermissionLevelString
>(
  'NullableBucketPermissionLevelFromString',
  (u): u is GQLTypes.BucketPermissionLevel | null =>
    u === null || BucketPermissionLevel.is(u),
  (u, c) => {
    if (u === 'None') return IO.success(null)
    if (u === 'Read') return IO.success(GQLTypes.BucketPermissionLevel.READ)
    if (u === 'ReadWrite') return IO.success(GQLTypes.BucketPermissionLevel.READ_WRITE)
    return IO.failure(u, c)
  },
  (a) => {
    if (a === GQLTypes.BucketPermissionLevel.READ) return 'Read' as const
    if (a === GQLTypes.BucketPermissionLevel.READ_WRITE) return 'ReadWrite' as const
    return 'None' as const
  },
)

export type PotentialCollaborator = {
  collaborator: GQLTypes.Collaborator
  permissionLevel?: undefined
}

export type Collaborators = ReadonlyArray<
  GQLTypes.CollaboratorBucketConnection | PotentialCollaborator
>

export interface PackageEntry {
  physicalKey: string
  hash: string
  meta: Types.JsonRecord | null
  size: number
}

export type PackageContentsFlatMap = Record<string, PackageEntry>
