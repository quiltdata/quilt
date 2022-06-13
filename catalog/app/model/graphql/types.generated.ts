import type { Json, JsonRecord } from 'utils/types'
import type { PackageContentsFlatMap } from 'model'

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
  PackageContentsFlatMap: PackageContentsFlatMap
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
  readonly associatedPolicies: ReadonlyArray<PolicyBucketPermission>
  readonly associatedRoles: ReadonlyArray<RoleBucketPermission>
  readonly collaborators: ReadonlyArray<CollaboratorBucketConnection>
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

export interface BucketPermission {
  readonly bucket: BucketConfig
  readonly level: BucketPermissionLevel
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

export interface Collaborator {
  readonly __typename: 'Collaborator'
  readonly email: Scalars['String']
  readonly username: Scalars['String']
}

export interface CollaboratorBucketConnection {
  readonly __typename: 'CollaboratorBucketConnection'
  readonly collaborator: Collaborator
  readonly permissionLevel: BucketPermissionLevel
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

export interface InputError {
  readonly __typename: 'InputError'
  readonly path: Maybe<Scalars['String']>
  readonly message: Scalars['String']
  readonly name: Scalars['String']
  readonly context: Maybe<Scalars['JsonRecord']>
}

export interface InsufficientPermissions {
  readonly __typename: 'InsufficientPermissions'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface InvalidInput {
  readonly __typename: 'InvalidInput'
  readonly errors: ReadonlyArray<InputError>
}

export interface ManagedPolicyInput {
  readonly title: Scalars['String']
  readonly permissions: ReadonlyArray<PermissionInput>
  readonly roles: ReadonlyArray<Scalars['ID']>
}

export interface ManagedRole {
  readonly __typename: 'ManagedRole'
  readonly id: Scalars['ID']
  readonly name: Scalars['String']
  readonly arn: Scalars['String']
  readonly policies: ReadonlyArray<Policy>
  readonly permissions: ReadonlyArray<RoleBucketPermission>
}

export interface ManagedRoleInput {
  readonly name: Scalars['String']
  readonly policies: ReadonlyArray<Scalars['ID']>
}

export interface Mutation {
  readonly __typename: 'Mutation'
  readonly packageConstruct: PackageConstructResult
  readonly packagePromote: PackagePromoteResult
  readonly packageFromFolder: PackageFromFolderResult
  readonly packageRevisionDelete: PackageRevisionDeleteResult
  readonly bucketAdd: BucketAddResult
  readonly bucketUpdate: BucketUpdateResult
  readonly bucketRemove: BucketRemoveResult
  readonly policyCreateManaged: PolicyResult
  readonly policyCreateUnmanaged: PolicyResult
  readonly policyUpdateManaged: PolicyResult
  readonly policyUpdateUnmanaged: PolicyResult
  readonly policyDelete: PolicyDeleteResult
  readonly roleCreateManaged: RoleCreateResult
  readonly roleCreateUnmanaged: RoleCreateResult
  readonly roleUpdateManaged: RoleUpdateResult
  readonly roleUpdateUnmanaged: RoleUpdateResult
  readonly roleDelete: RoleDeleteResult
  readonly roleSetDefault: RoleSetDefaultResult
}

export interface MutationpackageConstructArgs {
  params: PackagePushParams
  src: PackageConstructSource
}

export interface MutationpackagePromoteArgs {
  params: PackagePushParams
  src: PackagePromoteSource
}

export interface MutationpackageFromFolderArgs {
  params: PackagePushParams
  src: PackageFromFolderSource
}

export interface MutationpackageRevisionDeleteArgs {
  bucket: Scalars['String']
  name: Scalars['String']
  hash: Scalars['String']
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

export interface MutationpolicyCreateManagedArgs {
  input: ManagedPolicyInput
}

export interface MutationpolicyCreateUnmanagedArgs {
  input: UnmanagedPolicyInput
}

export interface MutationpolicyUpdateManagedArgs {
  id: Scalars['ID']
  input: ManagedPolicyInput
}

export interface MutationpolicyUpdateUnmanagedArgs {
  id: Scalars['ID']
  input: UnmanagedPolicyInput
}

export interface MutationpolicyDeleteArgs {
  id: Scalars['ID']
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

export interface MutationroleSetDefaultArgs {
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

export interface Ok {
  readonly __typename: 'Ok'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface OperationError {
  readonly __typename: 'OperationError'
  readonly message: Scalars['String']
  readonly name: Scalars['String']
  readonly context: Maybe<Scalars['JsonRecord']>
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

export interface PackageConstructEntry {
  readonly logicalKey: Scalars['String']
  readonly physicalKey: Scalars['String']
  readonly hash: Maybe<Scalars['String']>
  readonly size: Maybe<Scalars['Float']>
  readonly meta: Maybe<Scalars['JsonRecord']>
}

export type PackageConstructResult = PackagePushSuccess | InvalidInput | OperationError

export interface PackageConstructSource {
  readonly entries: ReadonlyArray<PackageConstructEntry>
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

export interface PackageFromFolderEntry {
  readonly isDir: Scalars['Boolean']
  readonly logicalKey: Scalars['String']
  readonly path: Scalars['String']
}

export type PackageFromFolderResult = PackagePushSuccess | InvalidInput | OperationError

export interface PackageFromFolderSource {
  readonly bucket: Scalars['String']
  readonly entries: ReadonlyArray<PackageFromFolderEntry>
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

export type PackagePromoteResult = PackagePushSuccess | InvalidInput | OperationError

export interface PackagePromoteSource {
  readonly bucket: Scalars['String']
  readonly name: Scalars['String']
  readonly hash: Scalars['String']
}

export interface PackagePushParams {
  readonly message: Maybe<Scalars['String']>
  readonly userMeta: Maybe<Scalars['JsonRecord']>
  readonly workflow: Maybe<Scalars['String']>
  readonly bucket: Scalars['String']
  readonly name: Scalars['String']
}

export interface PackagePushSuccess {
  readonly __typename: 'PackagePushSuccess'
  readonly package: Package
  readonly revision: PackageRevision
}

export interface PackageRevision {
  readonly __typename: 'PackageRevision'
  readonly hash: Scalars['String']
  readonly modified: Scalars['Datetime']
  readonly message: Maybe<Scalars['String']>
  readonly metadata: Scalars['JsonRecord']
  readonly userMeta: Maybe<Scalars['JsonRecord']>
  readonly workflow: Maybe<PackageWorkflow>
  readonly totalEntries: Maybe<Scalars['Int']>
  readonly totalBytes: Maybe<Scalars['Float']>
  readonly dir: Maybe<PackageDir>
  readonly file: Maybe<PackageFile>
  readonly accessCounts: Maybe<AccessCounts>
  readonly contentsFlatMap: Maybe<Scalars['PackageContentsFlatMap']>
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

export interface PackageRevisioncontentsFlatMapArgs {
  max?: Maybe<Scalars['Int']>
}

export type PackageRevisionDeleteResult = PackageRevisionDeleteSuccess | OperationError

export interface PackageRevisionDeleteSuccess {
  readonly __typename: 'PackageRevisionDeleteSuccess'
  readonly _: Maybe<Scalars['Boolean']>
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

export interface PackageWorkflow {
  readonly __typename: 'PackageWorkflow'
  readonly config: Scalars['String']
  readonly id: Maybe<Scalars['String']>
}

export interface PermissionInput {
  readonly bucket: Scalars['String']
  readonly level: BucketPermissionLevel
}

export interface Policy {
  readonly __typename: 'Policy'
  readonly id: Scalars['ID']
  readonly title: Scalars['String']
  readonly arn: Scalars['String']
  readonly managed: Scalars['Boolean']
  readonly permissions: ReadonlyArray<PolicyBucketPermission>
  readonly roles: ReadonlyArray<ManagedRole>
}

export interface PolicyBucketPermission extends BucketPermission {
  readonly __typename: 'PolicyBucketPermission'
  readonly policy: Policy
  readonly bucket: BucketConfig
  readonly level: BucketPermissionLevel
}

export type PolicyDeleteResult = Ok | InvalidInput | OperationError

export type PolicyResult = Policy | InvalidInput | OperationError

export interface Query {
  readonly __typename: 'Query'
  readonly config: Config
  readonly bucketConfigs: ReadonlyArray<BucketConfig>
  readonly bucketConfig: Maybe<BucketConfig>
  readonly potentialCollaborators: ReadonlyArray<Collaborator>
  readonly packages: Maybe<PackageList>
  readonly package: Maybe<Package>
  readonly policies: ReadonlyArray<Policy>
  readonly policy: Maybe<Policy>
  readonly roles: ReadonlyArray<Role>
  readonly role: Maybe<Role>
  readonly defaultRole: Maybe<Role>
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

export interface QuerypolicyArgs {
  id: Scalars['ID']
}

export interface QueryroleArgs {
  id: Scalars['ID']
}

export type Role = UnmanagedRole | ManagedRole

export interface RoleAssigned {
  readonly __typename: 'RoleAssigned'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface RoleBucketPermission extends BucketPermission {
  readonly __typename: 'RoleBucketPermission'
  readonly role: Role
  readonly bucket: BucketConfig
  readonly level: BucketPermissionLevel
}

export type RoleCreateResult =
  | RoleCreateSuccess
  | RoleNameReserved
  | RoleNameExists
  | RoleNameInvalid
  | RoleHasTooManyPoliciesToAttach

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

export interface RoleHasTooManyPoliciesToAttach {
  readonly __typename: 'RoleHasTooManyPoliciesToAttach'
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

export type RoleSetDefaultResult = RoleSetDefaultSuccess | RoleDoesNotExist

export interface RoleSetDefaultSuccess {
  readonly __typename: 'RoleSetDefaultSuccess'
  readonly role: Role
}

export type RoleUpdateResult =
  | RoleUpdateSuccess
  | RoleNameReserved
  | RoleNameExists
  | RoleNameInvalid
  | RoleIsManaged
  | RoleIsUnmanaged
  | RoleHasTooManyPoliciesToAttach

export interface RoleUpdateSuccess {
  readonly __typename: 'RoleUpdateSuccess'
  readonly role: Role
}

export interface SnsInvalid {
  readonly __typename: 'SnsInvalid'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface UnmanagedPolicyInput {
  readonly title: Scalars['String']
  readonly arn: Scalars['String']
  readonly roles: ReadonlyArray<Scalars['ID']>
}

export interface UnmanagedRole {
  readonly __typename: 'UnmanagedRole'
  readonly id: Scalars['ID']
  readonly name: Scalars['String']
  readonly arn: Scalars['String']
}

export interface UnmanagedRoleInput {
  readonly name: Scalars['String']
  readonly arn: Scalars['String']
}
