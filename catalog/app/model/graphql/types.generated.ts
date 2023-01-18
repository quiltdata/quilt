import type { Json, JsonRecord } from 'utils/types'
import type { PackageContentsFlatMap } from 'model'
import type { S3ObjectLocation } from 'model/S3'

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
  S3ObjectLocation: S3ObjectLocation
}

export interface AccessCountForDate {
  readonly __typename: 'AccessCountForDate'
  readonly date: Scalars['Datetime']
  readonly value: Scalars['Int']
}

export interface AccessCounts {
  readonly __typename: 'AccessCounts'
  readonly counts: ReadonlyArray<AccessCountForDate>
  readonly total: Scalars['Int']
}

export interface BucketAddInput {
  readonly delayScan: Maybe<Scalars['Boolean']>
  readonly description: Maybe<Scalars['String']>
  readonly fileExtensionsToIndex: Maybe<ReadonlyArray<Scalars['String']>>
  readonly iconUrl: Maybe<Scalars['String']>
  readonly indexContentBytes: Maybe<Scalars['Int']>
  readonly linkedData: Maybe<Scalars['Json']>
  readonly name: Scalars['String']
  readonly overviewUrl: Maybe<Scalars['String']>
  readonly relevanceScore: Maybe<Scalars['Int']>
  readonly scannerParallelShardsDepth: Maybe<Scalars['Int']>
  readonly skipMetaDataIndexing: Maybe<Scalars['Boolean']>
  readonly snsNotificationArn: Maybe<Scalars['String']>
  readonly tags: Maybe<ReadonlyArray<Scalars['String']>>
  readonly title: Scalars['String']
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
  readonly associatedPolicies: ReadonlyArray<PolicyBucketPermission>
  readonly associatedRoles: ReadonlyArray<RoleBucketPermission>
  readonly collaborators: ReadonlyArray<CollaboratorBucketConnection>
  readonly description: Maybe<Scalars['String']>
  readonly fileExtensionsToIndex: Maybe<ReadonlyArray<Scalars['String']>>
  readonly iconUrl: Maybe<Scalars['String']>
  readonly indexContentBytes: Maybe<Scalars['Int']>
  readonly lastIndexed: Maybe<Scalars['Datetime']>
  readonly linkedData: Maybe<Scalars['Json']>
  readonly name: Scalars['String']
  readonly overviewUrl: Maybe<Scalars['String']>
  readonly relevanceScore: Scalars['Int']
  readonly scannerParallelShardsDepth: Maybe<Scalars['Int']>
  readonly skipMetaDataIndexing: Maybe<Scalars['Boolean']>
  readonly snsNotificationArn: Maybe<Scalars['String']>
  readonly tags: Maybe<ReadonlyArray<Scalars['String']>>
  readonly title: Scalars['String']
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

export type BucketRemoveResult = BucketNotFound | BucketRemoveSuccess | IndexingInProgress

export interface BucketRemoveSuccess {
  readonly __typename: 'BucketRemoveSuccess'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface BucketUpdateInput {
  readonly description: Maybe<Scalars['String']>
  readonly fileExtensionsToIndex: Maybe<ReadonlyArray<Scalars['String']>>
  readonly iconUrl: Maybe<Scalars['String']>
  readonly indexContentBytes: Maybe<Scalars['Int']>
  readonly linkedData: Maybe<Scalars['Json']>
  readonly overviewUrl: Maybe<Scalars['String']>
  readonly relevanceScore: Maybe<Scalars['Int']>
  readonly scannerParallelShardsDepth: Maybe<Scalars['Int']>
  readonly skipMetaDataIndexing: Maybe<Scalars['Boolean']>
  readonly snsNotificationArn: Maybe<Scalars['String']>
  readonly tags: Maybe<ReadonlyArray<Scalars['String']>>
  readonly title: Scalars['String']
}

export type BucketUpdateResult =
  | BucketFileExtensionsToIndexInvalid
  | BucketIndexContentBytesInvalid
  | BucketNotFound
  | BucketUpdateSuccess
  | NotificationConfigurationError
  | NotificationTopicNotFound
  | SnsInvalid

export interface BucketUpdateSuccess {
  readonly __typename: 'BucketUpdateSuccess'
  readonly bucketConfig: BucketConfig
}

export interface Canary {
  readonly __typename: 'Canary'
  readonly description: Scalars['String']
  readonly group: Scalars['String']
  readonly lastRun: Maybe<Scalars['Datetime']>
  readonly name: Scalars['String']
  readonly ok: Maybe<Scalars['Boolean']>
  readonly region: Scalars['String']
  readonly schedule: Scalars['String']
  readonly title: Scalars['String']
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
  readonly bytesDefault: Scalars['Int']
  readonly bytesMax: Scalars['Int']
  readonly bytesMin: Scalars['Int']
  readonly extensions: ReadonlyArray<Scalars['String']>
}

export interface IndexingInProgress {
  readonly __typename: 'IndexingInProgress'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface InputError {
  readonly __typename: 'InputError'
  readonly context: Maybe<Scalars['JsonRecord']>
  readonly message: Scalars['String']
  readonly name: Scalars['String']
  readonly path: Maybe<Scalars['String']>
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
  readonly permissions: ReadonlyArray<PermissionInput>
  readonly roles: ReadonlyArray<Scalars['ID']>
  readonly title: Scalars['String']
}

export interface ManagedRole {
  readonly __typename: 'ManagedRole'
  readonly arn: Scalars['String']
  readonly id: Scalars['ID']
  readonly name: Scalars['String']
  readonly permissions: ReadonlyArray<RoleBucketPermission>
  readonly policies: ReadonlyArray<Policy>
}

export interface ManagedRoleInput {
  readonly name: Scalars['String']
  readonly policies: ReadonlyArray<Scalars['ID']>
}

export interface Mutation {
  readonly __typename: 'Mutation'
  readonly bucketAdd: BucketAddResult
  readonly bucketRemove: BucketRemoveResult
  readonly bucketUpdate: BucketUpdateResult
  readonly packageConstruct: PackageConstructResult
  readonly packageFromFolder: PackageFromFolderResult
  readonly packagePromote: PackagePromoteResult
  readonly packageRevisionDelete: PackageRevisionDeleteResult
  readonly policyCreateManaged: PolicyResult
  readonly policyCreateUnmanaged: PolicyResult
  readonly policyDelete: PolicyDeleteResult
  readonly policyUpdateManaged: PolicyResult
  readonly policyUpdateUnmanaged: PolicyResult
  readonly roleCreateManaged: RoleCreateResult
  readonly roleCreateUnmanaged: RoleCreateResult
  readonly roleDelete: RoleDeleteResult
  readonly roleSetDefault: RoleSetDefaultResult
  readonly roleUpdateManaged: RoleUpdateResult
  readonly roleUpdateUnmanaged: RoleUpdateResult
}

export interface MutationbucketAddArgs {
  input: BucketAddInput
}

export interface MutationbucketRemoveArgs {
  name: Scalars['String']
}

export interface MutationbucketUpdateArgs {
  input: BucketUpdateInput
  name: Scalars['String']
}

export interface MutationpackageConstructArgs {
  params: PackagePushParams
  src: PackageConstructSource
}

export interface MutationpackageFromFolderArgs {
  params: PackagePushParams
  src: PackageFromFolderSource
}

export interface MutationpackagePromoteArgs {
  params: PackagePushParams
  src: PackagePromoteSource
}

export interface MutationpackageRevisionDeleteArgs {
  bucket: Scalars['String']
  hash: Scalars['String']
  name: Scalars['String']
}

export interface MutationpolicyCreateManagedArgs {
  input: ManagedPolicyInput
}

export interface MutationpolicyCreateUnmanagedArgs {
  input: UnmanagedPolicyInput
}

export interface MutationpolicyDeleteArgs {
  id: Scalars['ID']
}

export interface MutationpolicyUpdateManagedArgs {
  id: Scalars['ID']
  input: ManagedPolicyInput
}

export interface MutationpolicyUpdateUnmanagedArgs {
  id: Scalars['ID']
  input: UnmanagedPolicyInput
}

export interface MutationroleCreateManagedArgs {
  input: ManagedRoleInput
}

export interface MutationroleCreateUnmanagedArgs {
  input: UnmanagedRoleInput
}

export interface MutationroleDeleteArgs {
  id: Scalars['ID']
}

export interface MutationroleSetDefaultArgs {
  id: Scalars['ID']
}

export interface MutationroleUpdateManagedArgs {
  id: Scalars['ID']
  input: ManagedRoleInput
}

export interface MutationroleUpdateUnmanagedArgs {
  id: Scalars['ID']
  input: UnmanagedRoleInput
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
  readonly context: Maybe<Scalars['JsonRecord']>
  readonly message: Scalars['String']
  readonly name: Scalars['String']
}

export interface Package {
  readonly __typename: 'Package'
  readonly accessCounts: Maybe<AccessCounts>
  readonly bucket: Scalars['String']
  readonly modified: Scalars['Datetime']
  readonly name: Scalars['String']
  readonly revision: Maybe<PackageRevision>
  readonly revisions: PackageRevisionList
}

export interface PackageaccessCountsArgs {
  window?: Maybe<Scalars['Int']>
}

export interface PackagerevisionArgs {
  hashOrTag?: Maybe<Scalars['String']>
}

export interface PackageConstructEntry {
  readonly hash: Maybe<Scalars['String']>
  readonly logicalKey: Scalars['String']
  readonly meta: Maybe<Scalars['JsonRecord']>
  readonly physicalKey: Scalars['String']
  readonly size: Maybe<Scalars['Float']>
}

export type PackageConstructResult = InvalidInput | OperationError | PackagePushSuccess

export interface PackageConstructSource {
  readonly entries: ReadonlyArray<PackageConstructEntry>
}

export interface PackageDir {
  readonly __typename: 'PackageDir'
  readonly children: ReadonlyArray<PackageEntry>
  readonly metadata: Maybe<Scalars['JsonRecord']>
  readonly path: Scalars['String']
  readonly size: Scalars['Float']
}

export type PackageEntry = PackageDir | PackageFile

export interface PackageFile {
  readonly __typename: 'PackageFile'
  readonly metadata: Maybe<Scalars['JsonRecord']>
  readonly path: Scalars['String']
  readonly physicalKey: Scalars['String']
  readonly size: Scalars['Float']
}

export interface PackageFromFolderEntry {
  readonly isDir: Scalars['Boolean']
  readonly logicalKey: Scalars['String']
  readonly path: Scalars['String']
}

export type PackageFromFolderResult = InvalidInput | OperationError | PackagePushSuccess

export interface PackageFromFolderSource {
  readonly bucket: Scalars['String']
  readonly entries: ReadonlyArray<PackageFromFolderEntry>
}

export interface PackageList {
  readonly __typename: 'PackageList'
  readonly page: ReadonlyArray<Package>
  readonly total: Scalars['Int']
}

export interface PackageListpageArgs {
  number?: Maybe<Scalars['Int']>
  order?: Maybe<PackageListOrder>
  perPage?: Maybe<Scalars['Int']>
}

export enum PackageListOrder {
  MODIFIED = 'MODIFIED',
  NAME = 'NAME',
}

export type PackagePromoteResult = InvalidInput | OperationError | PackagePushSuccess

export interface PackagePromoteSource {
  readonly bucket: Scalars['String']
  readonly hash: Scalars['String']
  readonly name: Scalars['String']
}

export interface PackagePushParams {
  readonly bucket: Scalars['String']
  readonly message: Maybe<Scalars['String']>
  readonly name: Scalars['String']
  readonly userMeta: Maybe<Scalars['JsonRecord']>
  readonly workflow: Maybe<Scalars['String']>
}

export interface PackagePushSuccess {
  readonly __typename: 'PackagePushSuccess'
  readonly package: Package
  readonly revision: PackageRevision
}

export interface PackageRevision {
  readonly __typename: 'PackageRevision'
  readonly accessCounts: Maybe<AccessCounts>
  readonly contentsFlatMap: Maybe<Scalars['PackageContentsFlatMap']>
  readonly dir: Maybe<PackageDir>
  readonly file: Maybe<PackageFile>
  readonly hash: Scalars['String']
  readonly message: Maybe<Scalars['String']>
  readonly metadata: Scalars['JsonRecord']
  readonly modified: Scalars['Datetime']
  readonly totalBytes: Maybe<Scalars['Float']>
  readonly totalEntries: Maybe<Scalars['Int']>
  readonly userMeta: Maybe<Scalars['JsonRecord']>
  readonly workflow: Maybe<PackageWorkflow>
}

export interface PackageRevisionaccessCountsArgs {
  window?: Maybe<Scalars['Int']>
}

export interface PackageRevisioncontentsFlatMapArgs {
  max?: Maybe<Scalars['Int']>
}

export interface PackageRevisiondirArgs {
  path: Scalars['String']
}

export interface PackageRevisionfileArgs {
  path: Scalars['String']
}

export type PackageRevisionDeleteResult = OperationError | PackageRevisionDeleteSuccess

export interface PackageRevisionDeleteSuccess {
  readonly __typename: 'PackageRevisionDeleteSuccess'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface PackageRevisionList {
  readonly __typename: 'PackageRevisionList'
  readonly page: ReadonlyArray<PackageRevision>
  readonly total: Scalars['Int']
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
  readonly arn: Scalars['String']
  readonly id: Scalars['ID']
  readonly managed: Scalars['Boolean']
  readonly permissions: ReadonlyArray<PolicyBucketPermission>
  readonly roles: ReadonlyArray<ManagedRole>
  readonly title: Scalars['String']
}

export interface PolicyBucketPermission extends BucketPermission {
  readonly __typename: 'PolicyBucketPermission'
  readonly bucket: BucketConfig
  readonly level: BucketPermissionLevel
  readonly policy: Policy
}

export type PolicyDeleteResult = InvalidInput | Ok | OperationError

export type PolicyResult = InvalidInput | OperationError | Policy

export interface Query {
  readonly __typename: 'Query'
  readonly bucketConfig: Maybe<BucketConfig>
  readonly bucketConfigs: ReadonlyArray<BucketConfig>
  readonly config: Config
  readonly defaultRole: Maybe<Role>
  readonly package: Maybe<Package>
  readonly packages: Maybe<PackageList>
  readonly policies: ReadonlyArray<Policy>
  readonly policy: Maybe<Policy>
  readonly potentialCollaborators: ReadonlyArray<Collaborator>
  readonly role: Maybe<Role>
  readonly roles: ReadonlyArray<Role>
  readonly status: StatusResult
}

export interface QuerybucketConfigArgs {
  name: Scalars['String']
}

export interface QuerypackageArgs {
  bucket: Scalars['String']
  name: Scalars['String']
}

export interface QuerypackagesArgs {
  bucket: Scalars['String']
  filter: Maybe<Scalars['String']>
}

export interface QuerypolicyArgs {
  id: Scalars['ID']
}

export interface QueryroleArgs {
  id: Scalars['ID']
}

export type Role = ManagedRole | UnmanagedRole

export interface RoleAssigned {
  readonly __typename: 'RoleAssigned'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface RoleBucketPermission extends BucketPermission {
  readonly __typename: 'RoleBucketPermission'
  readonly bucket: BucketConfig
  readonly level: BucketPermissionLevel
  readonly role: Role
}

export type RoleCreateResult =
  | RoleCreateSuccess
  | RoleHasTooManyPoliciesToAttach
  | RoleNameExists
  | RoleNameInvalid
  | RoleNameReserved

export interface RoleCreateSuccess {
  readonly __typename: 'RoleCreateSuccess'
  readonly role: Role
}

export type RoleDeleteResult =
  | RoleAssigned
  | RoleDeleteSuccess
  | RoleDoesNotExist
  | RoleNameReserved

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

export type RoleSetDefaultResult = RoleDoesNotExist | RoleSetDefaultSuccess

export interface RoleSetDefaultSuccess {
  readonly __typename: 'RoleSetDefaultSuccess'
  readonly role: Role
}

export type RoleUpdateResult =
  | RoleHasTooManyPoliciesToAttach
  | RoleIsManaged
  | RoleIsUnmanaged
  | RoleNameExists
  | RoleNameInvalid
  | RoleNameReserved
  | RoleUpdateSuccess

export interface RoleUpdateSuccess {
  readonly __typename: 'RoleUpdateSuccess'
  readonly role: Role
}

export interface SnsInvalid {
  readonly __typename: 'SnsInvalid'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface Status {
  readonly __typename: 'Status'
  readonly canaries: ReadonlyArray<Canary>
  readonly latestStats: TestStats
  readonly reports: StatusReportList
  readonly reportsBucket: Scalars['String']
  readonly stats: TestStatsTimeSeries
}

export interface StatusreportsArgs {
  filter: Maybe<StatusReportListFilter>
}

export interface StatusstatsArgs {
  window?: Maybe<Scalars['Int']>
}

export interface StatusReport {
  readonly __typename: 'StatusReport'
  readonly renderedReportLocation: Scalars['S3ObjectLocation']
  readonly timestamp: Scalars['Datetime']
}

export interface StatusReportList {
  readonly __typename: 'StatusReportList'
  readonly page: ReadonlyArray<StatusReport>
  readonly total: Scalars['Int']
}

export interface StatusReportListpageArgs {
  number?: Scalars['Int']
  order?: StatusReportListOrder
  perPage?: Scalars['Int']
}

export interface StatusReportListFilter {
  readonly timestampFrom: Maybe<Scalars['Datetime']>
  readonly timestampTo: Maybe<Scalars['Datetime']>
}

export enum StatusReportListOrder {
  NEW_FIRST = 'NEW_FIRST',
  OLD_FIRST = 'OLD_FIRST',
}

export type StatusResult = Status | Unavailable

export interface TestStats {
  readonly __typename: 'TestStats'
  readonly failed: Scalars['Int']
  readonly passed: Scalars['Int']
  readonly running: Scalars['Int']
}

export interface TestStatsTimeSeries {
  readonly __typename: 'TestStatsTimeSeries'
  readonly datetimes: ReadonlyArray<Scalars['Datetime']>
  readonly failed: ReadonlyArray<Scalars['Int']>
  readonly passed: ReadonlyArray<Scalars['Int']>
}

export interface Unavailable {
  readonly __typename: 'Unavailable'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface UnmanagedPolicyInput {
  readonly arn: Scalars['String']
  readonly roles: ReadonlyArray<Scalars['ID']>
  readonly title: Scalars['String']
}

export interface UnmanagedRole {
  readonly __typename: 'UnmanagedRole'
  readonly arn: Scalars['String']
  readonly id: Scalars['ID']
  readonly name: Scalars['String']
}

export interface UnmanagedRoleInput {
  readonly arn: Scalars['String']
  readonly name: Scalars['String']
}
