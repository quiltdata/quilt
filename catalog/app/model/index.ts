import * as IO from 'io-ts'

import assertNever from 'utils/assertNever'
import * as Types from 'utils/types'

import * as GQLTypes from './graphql/types.generated'

export * as GQLTypes from './graphql/types.generated'

export * as S3 from './S3'

export const BucketPermissionLevel = Types.enum(
  GQLTypes.BucketPermissionLevel,
  'BucketPermissionLevel',
)

export const BucketPermissionLevelStrings = ['Read', 'ReadWrite'] as const

export type BucketPermissionLevelString = (typeof BucketPermissionLevelStrings)[number]

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

// Note that the actual user-defined meta is in the `user_meta` field
export type EntryMeta = (Types.JsonRecord & { user_meta?: Types.JsonRecord }) | null

export const CHECKSUM_TYPE_SHA256 = 'SHA256' as const
export const CHECKSUM_TYPE_SHA256_CHUNKED = 'sha2-256-chunked' as const
export const CHECKSUM_TYPE_CRC64NVME = 'CRC64NVME' as const
export const CHECKSUM_TYPES = [
  CHECKSUM_TYPE_SHA256,
  CHECKSUM_TYPE_SHA256_CHUNKED,
  CHECKSUM_TYPE_CRC64NVME,
]

export type ChecksumType = (typeof CHECKSUM_TYPES)[number]

export interface Checksum {
  type: ChecksumType
  value: string
}

export interface PackageEntry {
  // TODO: replace with { address: { physicalKey: string }}
  //       so, you can merge PackageEntry and S3File
  physicalKey: string
  hash: Checksum
  meta?: EntryMeta
  size: number
}

export type PackageContentsFlatMap = Record<string, PackageEntry>

export interface S3File {
  // TODO: replace with { address: { handle: S3.S3ObjectLocation }}
  //       so, you can merge PackageEntry and S3File
  bucket: string
  key: string
  meta?: EntryMeta
  size: number
  version?: string
}
