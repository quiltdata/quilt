import type { Json, JsonRecord } from 'utils/types'

export type Maybe<T> = T | null
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>
}
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>
}
/** All built-in and custom scalars, mapped to their actual values */
export interface Scalars {
  ID: string
  String: string
  Boolean: boolean
  Int: number
  Float: number
  Datetime: Date
  Json: Json
  JsonRecord: JsonRecord
}

export interface AccessCountForDate {
  readonly __typename: 'AccessCountForDate'
  readonly date: Scalars['Datetime']
  readonly value: Scalars['Int']
}

export interface AccessCounts {
  readonly __typename: 'AccessCounts'
  readonly total: Scalars['Int']
  readonly counts: ReadonlyArray<AccessCountForDate>
}

export interface BucketAddInput {
  readonly name: Scalars['String']
  readonly title: Scalars['String']
  readonly iconUrl: Maybe<Scalars['String']>
  readonly description: Maybe<Scalars['String']>
  readonly linkedData: Maybe<Scalars['Json']>
  readonly overviewUrl: Maybe<Scalars['String']>
  readonly tags: Maybe<ReadonlyArray<Scalars['String']>>
  readonly relevanceScore: Maybe<Scalars['Int']>
  readonly snsNotificationArn: Maybe<Scalars['String']>
  readonly scannerParallelShardsDepth: Maybe<Scalars['Int']>
  readonly skipMetaDataIndexing: Maybe<Scalars['Boolean']>
  readonly fileExtensionsToIndex: Maybe<ReadonlyArray<Scalars['String']>>
  readonly indexContentBytes: Maybe<Scalars['Int']>
  readonly setVersioning: Maybe<Scalars['Boolean']>
  readonly delayScan: Maybe<Scalars['Boolean']>
}

export type BucketAddResult =
  | BucketAddSuccess
  | BucketAlreadyAdded
  | BucketDoesNotExist
  | BucketFileExtensionsToIndexInvalid
  | BucketIndexContentBytesInvalid
  | InsufficientPermissions
  | NotificationConfigurationError
  | NotificationTopicNotFound
  | SnsInvalid

export interface BucketAddSuccess {
  readonly __typename: 'BucketAddSuccess'
  readonly bucketConfig: BucketConfig
}

export interface BucketAlreadyAdded {
  readonly __typename: 'BucketAlreadyAdded'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface BucketConfig {
  readonly __typename: 'BucketConfig'
  readonly name: Scalars['String']
  readonly title: Scalars['String']
  readonly iconUrl: Maybe<Scalars['String']>
  readonly description: Maybe<Scalars['String']>
  readonly linkedData: Maybe<Scalars['Json']>
  readonly overviewUrl: Maybe<Scalars['String']>
  readonly tags: Maybe<ReadonlyArray<Scalars['String']>>
  readonly relevanceScore: Scalars['Int']
  readonly lastIndexed: Maybe<Scalars['Datetime']>
  readonly snsNotificationArn: Maybe<Scalars['String']>
  readonly scannerParallelShardsDepth: Maybe<Scalars['Int']>
  readonly skipMetaDataIndexing: Maybe<Scalars['Boolean']>
  readonly fileExtensionsToIndex: Maybe<ReadonlyArray<Scalars['String']>>
  readonly indexContentBytes: Maybe<Scalars['Int']>
  readonly permissions: ReadonlyArray<RoleBucketPermission>
}

export interface BucketConfigDoesNotExist {
  readonly __typename: 'BucketConfigDoesNotExist'
  readonly name: Scalars['String']
}

export interface BucketDoesNotExist {
  readonly __typename: 'BucketDoesNotExist'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface BucketFileExtensionsToIndexInvalid {
  readonly __typename: 'BucketFileExtensionsToIndexInvalid'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface BucketIndexContentBytesInvalid {
  readonly __typename: 'BucketIndexContentBytesInvalid'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface BucketNotFound {
  readonly __typename: 'BucketNotFound'
  readonly _: Maybe<Scalars['Boolean']>
}

export enum BucketPermissionLevel {
  READ = 'READ',
  READ_WRITE = 'READ_WRITE',
}

export type BucketRemoveResult = BucketRemoveSuccess | BucketNotFound | IndexingInProgress

export interface BucketRemoveSuccess {
  readonly __typename: 'BucketRemoveSuccess'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface BucketUpdateInput {
  readonly title: Scalars['String']
  readonly iconUrl: Maybe<Scalars['String']>
  readonly description: Maybe<Scalars['String']>
  readonly linkedData: Maybe<Scalars['Json']>
  readonly overviewUrl: Maybe<Scalars['String']>
  readonly tags: Maybe<ReadonlyArray<Scalars['String']>>
  readonly relevanceScore: Maybe<Scalars['Int']>
  readonly snsNotificationArn: Maybe<Scalars['String']>
  readonly scannerParallelShardsDepth: Maybe<Scalars['Int']>
  readonly skipMetaDataIndexing: Maybe<Scalars['Boolean']>
  readonly fileExtensionsToIndex: Maybe<ReadonlyArray<Scalars['String']>>
  readonly indexContentBytes: Maybe<Scalars['Int']>
  readonly setVersioning: Maybe<Scalars['Boolean']>
}

export type BucketUpdateResult =
  | BucketUpdateSuccess
  | BucketFileExtensionsToIndexInvalid
  | BucketIndexContentBytesInvalid
  | BucketNotFound
  | NotificationConfigurationError
  | NotificationTopicNotFound
  | SnsInvalid

export interface BucketUpdateSuccess {
  readonly __typename: 'BucketUpdateSuccess'
  readonly bucketConfig: BucketConfig
}

export interface Config {
  readonly __typename: 'Config'
  readonly contentIndexingSettings: ContentIndexingSettings
}

export interface ContentIndexingSettings {
  readonly __typename: 'ContentIndexingSettings'
  readonly extensions: ReadonlyArray<Scalars['String']>
  readonly bytesDefault: Scalars['Int']
  readonly bytesMin: Scalars['Int']
  readonly bytesMax: Scalars['Int']
}

export interface IndexingInProgress {
  readonly __typename: 'IndexingInProgress'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface InsufficientPermissions {
  readonly __typename: 'InsufficientPermissions'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface ManagedRole {
  readonly __typename: 'ManagedRole'
  readonly id: Scalars['ID']
  readonly name: Scalars['String']
  readonly arn: Maybe<Scalars['String']>
  readonly permissions: ReadonlyArray<RoleBucketPermission>
}

export interface ManagedRoleInput {
  readonly name: Scalars['String']
  readonly permissions: ReadonlyArray<PermissionInput>
}

export interface Mutation {
  readonly __typename: 'Mutation'
  readonly bucketAdd: BucketAddResult
  readonly bucketUpdate: BucketUpdateResult
  readonly bucketRemove: BucketRemoveResult
  readonly roleCreateManaged: RoleCreateResult
  readonly roleCreateUnmanaged: RoleCreateResult
  readonly roleUpdateManaged: RoleUpdateResult
  readonly roleUpdateUnmanaged: RoleUpdateResult
  readonly roleDelete: RoleDeleteResult
}

export interface MutationbucketAddArgs {
  input: BucketAddInput
}

export interface MutationbucketUpdateArgs {
  name: Scalars['String']
  input: BucketUpdateInput
}

export interface MutationbucketRemoveArgs {
  name: Scalars['String']
}

export interface MutationroleCreateManagedArgs {
  input: ManagedRoleInput
}

export interface MutationroleCreateUnmanagedArgs {
  input: UnmanagedRoleInput
}

export interface MutationroleUpdateManagedArgs {
  id: Scalars['ID']
  input: ManagedRoleInput
}

export interface MutationroleUpdateUnmanagedArgs {
  id: Scalars['ID']
  input: UnmanagedRoleInput
}

export interface MutationroleDeleteArgs {
  id: Scalars['ID']
}

export interface NotificationConfigurationError {
  readonly __typename: 'NotificationConfigurationError'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface NotificationTopicNotFound {
  readonly __typename: 'NotificationTopicNotFound'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface Package {
  readonly __typename: 'Package'
  readonly bucket: Scalars['String']
  readonly name: Scalars['String']
  readonly modified: Scalars['Datetime']
  readonly revisions: PackageRevisionList
  readonly revision: Maybe<PackageRevision>
  readonly accessCounts: Maybe<AccessCounts>
}

export interface PackagerevisionArgs {
  hashOrTag?: Maybe<Scalars['String']>
}

export interface PackageaccessCountsArgs {
  window?: Maybe<Scalars['Int']>
}

export interface PackageDir {
  readonly __typename: 'PackageDir'
  readonly path: Scalars['String']
  readonly metadata: Maybe<Scalars['JsonRecord']>
  readonly size: Scalars['Float']
  readonly children: ReadonlyArray<PackageEntry>
}

export type PackageEntry = PackageFile | PackageDir

export interface PackageFile {
  readonly __typename: 'PackageFile'
  readonly path: Scalars['String']
  readonly metadata: Maybe<Scalars['JsonRecord']>
  readonly size: Scalars['Float']
  readonly physicalKey: Scalars['String']
}

export interface PackageList {
  readonly __typename: 'PackageList'
  readonly total: Scalars['Int']
  readonly page: ReadonlyArray<Package>
}

export interface PackageListpageArgs {
  number?: Maybe<Scalars['Int']>
  perPage?: Maybe<Scalars['Int']>
  order?: Maybe<PackageListOrder>
}

export enum PackageListOrder {
  NAME = 'NAME',
  MODIFIED = 'MODIFIED',
}

export interface PackageRevision {
  readonly __typename: 'PackageRevision'
  readonly hash: Scalars['String']
  readonly modified: Scalars['Datetime']
  readonly message: Maybe<Scalars['String']>
  readonly metadata: Scalars['JsonRecord']
  readonly userMeta: Maybe<Scalars['JsonRecord']>
  readonly totalEntries: Maybe<Scalars['Int']>
  readonly totalBytes: Maybe<Scalars['Float']>
  readonly dir: Maybe<PackageDir>
  readonly file: Maybe<PackageFile>
  readonly accessCounts: Maybe<AccessCounts>
}

export interface PackageRevisiondirArgs {
  path: Scalars['String']
}

export interface PackageRevisionfileArgs {
  path: Scalars['String']
}

export interface PackageRevisionaccessCountsArgs {
  window?: Maybe<Scalars['Int']>
}

export interface PackageRevisionList {
  readonly __typename: 'PackageRevisionList'
  readonly total: Scalars['Int']
  readonly page: ReadonlyArray<PackageRevision>
}

export interface PackageRevisionListpageArgs {
  number?: Maybe<Scalars['Int']>
  perPage?: Maybe<Scalars['Int']>
}

export interface PermissionInput {
  readonly bucket: Scalars['String']
  readonly level: Maybe<BucketPermissionLevel>
}

export interface Query {
  readonly __typename: 'Query'
  readonly config: Config
  readonly bucketConfigs: ReadonlyArray<BucketConfig>
  readonly bucketConfig: Maybe<BucketConfig>
  readonly packages: Maybe<PackageList>
  readonly package: Maybe<Package>
  readonly roles: ReadonlyArray<Role>
  readonly role: Maybe<Role>
}

export interface QuerybucketConfigArgs {
  name: Scalars['String']
}

export interface QuerypackagesArgs {
  bucket: Scalars['String']
  filter: Maybe<Scalars['String']>
}

export interface QuerypackageArgs {
  bucket: Scalars['String']
  name: Scalars['String']
}

export interface QueryroleArgs {
  id: Scalars['ID']
}

export type Role = UnmanagedRole | ManagedRole

export interface RoleAssigned {
  readonly __typename: 'RoleAssigned'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface RoleBucketPermission {
  readonly __typename: 'RoleBucketPermission'
  readonly role: Role
  readonly bucket: BucketConfig
  readonly level: Maybe<BucketPermissionLevel>
}

export type RoleCreateResult =
  | RoleCreateSuccess
  | RoleNameReserved
  | RoleNameExists
  | RoleNameInvalid
  | BucketConfigDoesNotExist

export interface RoleCreateSuccess {
  readonly __typename: 'RoleCreateSuccess'
  readonly role: Role
}

export type RoleDeleteResult =
  | RoleDeleteSuccess
  | RoleDoesNotExist
  | RoleNameReserved
  | RoleAssigned

export interface RoleDeleteSuccess {
  readonly __typename: 'RoleDeleteSuccess'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface RoleDoesNotExist {
  readonly __typename: 'RoleDoesNotExist'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface RoleIsManaged {
  readonly __typename: 'RoleIsManaged'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface RoleIsUnmanaged {
  readonly __typename: 'RoleIsUnmanaged'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface RoleNameExists {
  readonly __typename: 'RoleNameExists'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface RoleNameInvalid {
  readonly __typename: 'RoleNameInvalid'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface RoleNameReserved {
  readonly __typename: 'RoleNameReserved'
  readonly _: Maybe<Scalars['Boolean']>
}

export type RoleUpdateResult =
  | RoleUpdateSuccess
  | RoleNameReserved
  | RoleNameExists
  | RoleNameInvalid
  | RoleIsManaged
  | RoleIsUnmanaged
  | BucketConfigDoesNotExist

export interface RoleUpdateSuccess {
  readonly __typename: 'RoleUpdateSuccess'
  readonly role: Role
}

export interface SnsInvalid {
  readonly __typename: 'SnsInvalid'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface UnmanagedRole {
  readonly __typename: 'UnmanagedRole'
  readonly id: Scalars['ID']
  readonly name: Scalars['String']
  readonly arn: Maybe<Scalars['String']>
}

export interface UnmanagedRoleInput {
  readonly name: Scalars['String']
  readonly arn: Scalars['String']
}
