import * as IO from 'io-ts'

import assertNever from 'utils/assertNever'
import * as Types from 'utils/types'

import * as GQLTypes from './graphql/types.generated'

export * as GQLTypes from './graphql/types.generated'

export const BucketPermissionLevel = Types.enum(
  GQLTypes.BucketPermissionLevel,
  'BucketPermissionLevel',
)

export const BucketPermissionLevelStrings = ['Read', 'ReadWrite'] as const

export type BucketPermissionLevelString = typeof BucketPermissionLevelStrings[number]

export const BucketPermissionLevelFromString = new IO.Type<
  GQLTypes.BucketPermissionLevel,
  BucketPermissionLevelString
>(
  'BucketPermissionLevelFromString',
  BucketPermissionLevel.is,
  (u, c) => {
    if (u === 'Read') return IO.success(GQLTypes.BucketPermissionLevel.READ)
    if (u === 'ReadWrite') return IO.success(GQLTypes.BucketPermissionLevel.READ_WRITE)
    return IO.failure(u, c)
  },
  (a) => {
    if (a === GQLTypes.BucketPermissionLevel.READ) return 'Read' as const
    if (a === GQLTypes.BucketPermissionLevel.READ_WRITE) return 'ReadWrite' as const
    return assertNever(a)
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
