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
  readonly total: Scalars['Int']
  readonly counts: ReadonlyArray<AccessCountForDate>
}

export interface AccessCountsGroup {
  readonly __typename: 'AccessCountsGroup'
  readonly ext: Scalars['String']
  readonly counts: AccessCounts
}

export interface AdminMutations {
  readonly __typename: 'AdminMutations'
  readonly user: UserAdminMutations
  readonly setSsoConfig: Maybe<SetSsoConfigResult>
  /** @deprecated Field no longer supported */
  readonly bucketSetTabulatorTable: BucketSetTabulatorTableResult
  /** @deprecated Field no longer supported */
  readonly bucketRenameTabulatorTable: BucketSetTabulatorTableResult
  readonly setTabulatorOpenQuery: TabulatorOpenQueryResult
  readonly packager: PackagerAdminMutations
}

export interface AdminMutationssetSsoConfigArgs {
  config: Maybe<Scalars['String']>
}

export interface AdminMutationsbucketSetTabulatorTableArgs {
  bucketName: Scalars['String']
  tableName: Scalars['String']
  config: Maybe<Scalars['String']>
}

export interface AdminMutationsbucketRenameTabulatorTableArgs {
  bucketName: Scalars['String']
  tableName: Scalars['String']
  newTableName: Scalars['String']
}

export interface AdminMutationssetTabulatorOpenQueryArgs {
  enabled: Scalars['Boolean']
}

export interface AdminQueries {
  readonly __typename: 'AdminQueries'
  readonly user: UserAdminQueries
  readonly ssoConfig: Maybe<SsoConfig>
  readonly isDefaultRoleSettingDisabled: Scalars['Boolean']
  readonly tabulatorOpenQuery: Scalars['Boolean']
  readonly packager: PackagerAdminQueries
}

export interface BooleanPackageUserMetaFacet extends IPackageUserMetaFacet {
  readonly __typename: 'BooleanPackageUserMetaFacet'
  readonly path: Scalars['String']
}

export interface BooleanSearchPredicate {
  readonly true: Maybe<Scalars['Boolean']>
  readonly false: Maybe<Scalars['Boolean']>
}

export interface BrowsingSession {
  readonly __typename: 'BrowsingSession'
  readonly id: Scalars['ID']
  readonly expires: Scalars['Datetime']
}

export type BrowsingSessionCreateResult = BrowsingSession | InvalidInput | OperationError

export type BrowsingSessionDisposeResult = Ok | OperationError

export type BrowsingSessionRefreshResult = BrowsingSession | InvalidInput | OperationError

export interface BucketAccessCounts {
  readonly __typename: 'BucketAccessCounts'
  readonly byExt: ReadonlyArray<AccessCountsGroup>
  readonly combined: AccessCounts
}

export interface BucketAccessCountsbyExtArgs {
  groups: Maybe<Scalars['Int']>
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
  readonly delayScan: Maybe<Scalars['Boolean']>
  readonly browsable: Maybe<Scalars['Boolean']>
  readonly prefixes: Maybe<ReadonlyArray<Scalars['String']>>
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
  | SubscriptionInvalid

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
  readonly browsable: Scalars['Boolean']
  readonly snsNotificationArn: Maybe<Scalars['String']>
  readonly scannerParallelShardsDepth: Maybe<Scalars['Int']>
  readonly skipMetaDataIndexing: Maybe<Scalars['Boolean']>
  readonly fileExtensionsToIndex: Maybe<ReadonlyArray<Scalars['String']>>
  readonly indexContentBytes: Maybe<Scalars['Int']>
  readonly prefixes: Maybe<ReadonlyArray<Scalars['String']>>
  readonly associatedPolicies: ReadonlyArray<PolicyBucketPermission>
  readonly associatedRoles: ReadonlyArray<RoleBucketPermission>
  readonly collaborators: ReadonlyArray<CollaboratorBucketConnection>
  readonly tabulatorTables: ReadonlyArray<TabulatorTable>
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

export type BucketSetTabulatorTableResult = BucketConfig | InvalidInput | OperationError

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
  readonly browsable: Maybe<Scalars['Boolean']>
  readonly prefixes: Maybe<ReadonlyArray<Scalars['String']>>
}

export type BucketUpdateResult =
  | BucketUpdateSuccess
  | BucketFileExtensionsToIndexInvalid
  | BucketIndexContentBytesInvalid
  | BucketNotFound
  | InsufficientPermissions
  | NotificationConfigurationError
  | NotificationTopicNotFound
  | SnsInvalid

export interface BucketUpdateSuccess {
  readonly __typename: 'BucketUpdateSuccess'
  readonly bucketConfig: BucketConfig
}

export interface Canary {
  readonly __typename: 'Canary'
  readonly name: Scalars['String']
  readonly region: Scalars['String']
  readonly group: Scalars['String']
  readonly title: Scalars['String']
  readonly description: Scalars['String']
  readonly schedule: Scalars['String']
  readonly ok: Maybe<Scalars['Boolean']>
  readonly lastRun: Maybe<Scalars['Datetime']>
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

export interface DatetimeExtents {
  readonly __typename: 'DatetimeExtents'
  readonly min: Scalars['Datetime']
  readonly max: Scalars['Datetime']
}

export interface DatetimePackageUserMetaFacet extends IPackageUserMetaFacet {
  readonly __typename: 'DatetimePackageUserMetaFacet'
  readonly path: Scalars['String']
  readonly extents: DatetimeExtents
}

export interface DatetimeSearchPredicate {
  readonly gte: Maybe<Scalars['Datetime']>
  readonly lte: Maybe<Scalars['Datetime']>
}

export interface EmptySearchResultSet {
  readonly __typename: 'EmptySearchResultSet'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface IPackageUserMetaFacet {
  readonly path: Scalars['String']
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
  readonly message: Scalars['String']
}

export interface InvalidInput {
  readonly __typename: 'InvalidInput'
  readonly errors: ReadonlyArray<InputError>
}

export interface KeywordExtents {
  readonly __typename: 'KeywordExtents'
  readonly values: ReadonlyArray<Scalars['String']>
}

export interface KeywordPackageUserMetaFacet extends IPackageUserMetaFacet {
  readonly __typename: 'KeywordPackageUserMetaFacet'
  readonly path: Scalars['String']
  readonly extents: KeywordExtents
}

export interface KeywordSearchPredicate {
  readonly terms: Maybe<ReadonlyArray<Scalars['String']>>
  readonly wildcard: Maybe<Scalars['String']>
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

export interface Me {
  readonly __typename: 'Me'
  readonly name: Scalars['String']
  readonly email: Scalars['String']
  readonly isAdmin: Scalars['Boolean']
  readonly role: MyRole
  readonly roles: ReadonlyArray<MyRole>
}

export interface MutateUserAdminMutations {
  readonly __typename: 'MutateUserAdminMutations'
  readonly delete: OperationResult
  readonly setEmail: UserResult
  readonly setRole: UserResult
  readonly addRoles: UserResult
  readonly removeRoles: UserResult
  readonly setAdmin: UserResult
  readonly setActive: UserResult
  readonly resetPassword: OperationResult
}

export interface MutateUserAdminMutationssetEmailArgs {
  email: Scalars['String']
}

export interface MutateUserAdminMutationssetRoleArgs {
  role: Scalars['String']
  extraRoles: Maybe<ReadonlyArray<Scalars['String']>>
  append?: Scalars['Boolean']
}

export interface MutateUserAdminMutationsaddRolesArgs {
  roles: ReadonlyArray<Scalars['String']>
}

export interface MutateUserAdminMutationsremoveRolesArgs {
  roles: ReadonlyArray<Scalars['String']>
  fallback: Maybe<Scalars['String']>
}

export interface MutateUserAdminMutationssetAdminArgs {
  admin: Scalars['Boolean']
}

export interface MutateUserAdminMutationssetActiveArgs {
  active: Scalars['Boolean']
}

export interface Mutation {
  readonly __typename: 'Mutation'
  readonly switchRole: SwitchRoleResult
  readonly packageConstruct: PackageConstructResult
  readonly packagePromote: PackagePromoteResult
  readonly packageRevisionDelete: PackageRevisionDeleteResult
  readonly admin: AdminMutations
  readonly bucketAdd: BucketAddResult
  readonly bucketUpdate: BucketUpdateResult
  readonly bucketRemove: BucketRemoveResult
  readonly bucketSetTabulatorTable: BucketSetTabulatorTableResult
  readonly bucketRenameTabulatorTable: BucketSetTabulatorTableResult
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
  readonly browsingSessionCreate: BrowsingSessionCreateResult
  readonly browsingSessionRefresh: BrowsingSessionRefreshResult
  readonly browsingSessionDispose: BrowsingSessionDisposeResult
}

export interface MutationswitchRoleArgs {
  roleName: Scalars['String']
}

export interface MutationpackageConstructArgs {
  params: PackagePushParams
  src: PackageConstructSource
}

export interface MutationpackagePromoteArgs {
  params: PackagePushParams
  src: PackagePromoteSource
  destPrefix: Maybe<Scalars['String']>
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

export interface MutationbucketSetTabulatorTableArgs {
  bucketName: Scalars['String']
  tableName: Scalars['String']
  config: Maybe<Scalars['String']>
}

export interface MutationbucketRenameTabulatorTableArgs {
  bucketName: Scalars['String']
  tableName: Scalars['String']
  newTableName: Scalars['String']
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

export interface MutationbrowsingSessionCreateArgs {
  scope: Scalars['String']
  ttl?: Scalars['Int']
}

export interface MutationbrowsingSessionRefreshArgs {
  id: Scalars['ID']
  ttl?: Scalars['Int']
}

export interface MutationbrowsingSessionDisposeArgs {
  id: Scalars['ID']
}

export interface MyRole {
  readonly __typename: 'MyRole'
  readonly name: Scalars['String']
}

export interface NotificationConfigurationError {
  readonly __typename: 'NotificationConfigurationError'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface NotificationTopicNotFound {
  readonly __typename: 'NotificationTopicNotFound'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface NumberExtents {
  readonly __typename: 'NumberExtents'
  readonly min: Scalars['Float']
  readonly max: Scalars['Float']
}

export interface NumberPackageUserMetaFacet extends IPackageUserMetaFacet {
  readonly __typename: 'NumberPackageUserMetaFacet'
  readonly path: Scalars['String']
  readonly extents: NumberExtents
}

export interface NumberSearchPredicate {
  readonly gte: Maybe<Scalars['Float']>
  readonly lte: Maybe<Scalars['Float']>
}

export interface ObjectsSearchFilter {
  readonly modified: Maybe<DatetimeSearchPredicate>
  readonly size: Maybe<NumberSearchPredicate>
  readonly ext: Maybe<KeywordSearchPredicate>
  readonly key: Maybe<KeywordSearchPredicate>
  readonly content: Maybe<TextSearchPredicate>
  readonly deleted: Maybe<BooleanSearchPredicate>
}

export type ObjectsSearchMoreResult =
  | ObjectsSearchResultSetPage
  | InvalidInput
  | OperationError

export type ObjectsSearchResult =
  | ObjectsSearchResultSet
  | EmptySearchResultSet
  | InvalidInput
  | OperationError

export interface ObjectsSearchResultSet {
  readonly __typename: 'ObjectsSearchResultSet'
  readonly total: Scalars['Int']
  readonly stats: ObjectsSearchStats
  readonly firstPage: ObjectsSearchResultSetPage
}

export interface ObjectsSearchResultSetfirstPageArgs {
  size?: Maybe<Scalars['Int']>
  order: Maybe<SearchResultOrder>
}

export interface ObjectsSearchResultSetPage {
  readonly __typename: 'ObjectsSearchResultSetPage'
  readonly cursor: Maybe<Scalars['String']>
  readonly hits: ReadonlyArray<SearchHitObject>
}

export interface ObjectsSearchStats {
  readonly __typename: 'ObjectsSearchStats'
  readonly modified: DatetimeExtents
  readonly size: NumberExtents
  readonly ext: KeywordExtents
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

export type OperationResult = Ok | InvalidInput | OperationError

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
  readonly hash: Maybe<PackageEntryHash>
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

export interface PackageEntryHash {
  readonly type: Scalars['String']
  readonly value: Scalars['String']
}

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

export type PackageUserMetaFacet =
  | NumberPackageUserMetaFacet
  | DatetimePackageUserMetaFacet
  | KeywordPackageUserMetaFacet
  | TextPackageUserMetaFacet
  | BooleanPackageUserMetaFacet

export enum PackageUserMetaFacetType {
  NUMBER = 'NUMBER',
  DATETIME = 'DATETIME',
  KEYWORD = 'KEYWORD',
  TEXT = 'TEXT',
  BOOLEAN = 'BOOLEAN',
}

export interface PackageUserMetaPredicate {
  readonly path: Scalars['String']
  readonly datetime: Maybe<DatetimeSearchPredicate>
  readonly number: Maybe<NumberSearchPredicate>
  readonly text: Maybe<TextSearchPredicate>
  readonly keyword: Maybe<KeywordSearchPredicate>
  readonly boolean: Maybe<BooleanSearchPredicate>
}

export interface PackageWorkflow {
  readonly __typename: 'PackageWorkflow'
  readonly config: Scalars['String']
  readonly id: Maybe<Scalars['String']>
}

export interface PackagerAdminMutations {
  readonly __typename: 'PackagerAdminMutations'
  readonly toggleEventRule: PackagerEventRuleToggleResult
}

export interface PackagerAdminMutationstoggleEventRuleArgs {
  name: Scalars['String']
  enabled: Scalars['Boolean']
}

export interface PackagerAdminQueries {
  readonly __typename: 'PackagerAdminQueries'
  readonly eventRules: ReadonlyArray<PackagerEventRule>
  readonly eventRule: Maybe<PackagerEventRule>
}

export interface PackagerAdminQuerieseventRuleArgs {
  name: Scalars['String']
}

export interface PackagerEventRule {
  readonly __typename: 'PackagerEventRule'
  readonly name: Scalars['String']
  readonly enabled: Scalars['Boolean']
}

export type PackagerEventRuleToggleResult =
  | PackagerEventRule
  | OperationError
  | InvalidInput

export interface PackagesSearchFilter {
  readonly modified: Maybe<DatetimeSearchPredicate>
  readonly size: Maybe<NumberSearchPredicate>
  readonly name: Maybe<KeywordSearchPredicate>
  readonly hash: Maybe<KeywordSearchPredicate>
  readonly entries: Maybe<NumberSearchPredicate>
  readonly comment: Maybe<TextSearchPredicate>
  readonly workflow: Maybe<KeywordSearchPredicate>
}

export type PackagesSearchMoreResult =
  | PackagesSearchResultSetPage
  | InvalidInput
  | OperationError

export type PackagesSearchResult =
  | PackagesSearchResultSet
  | EmptySearchResultSet
  | InvalidInput
  | OperationError

export interface PackagesSearchResultSet {
  readonly __typename: 'PackagesSearchResultSet'
  readonly total: Scalars['Int']
  readonly stats: PackagesSearchStats
  readonly filteredUserMetaFacets: ReadonlyArray<PackageUserMetaFacet>
  readonly firstPage: PackagesSearchResultSetPage
}

export interface PackagesSearchResultSetfilteredUserMetaFacetsArgs {
  path: Scalars['String']
  type: Maybe<PackageUserMetaFacetType>
}

export interface PackagesSearchResultSetfirstPageArgs {
  size?: Maybe<Scalars['Int']>
  order: Maybe<SearchResultOrder>
}

export interface PackagesSearchResultSetPage {
  readonly __typename: 'PackagesSearchResultSetPage'
  readonly cursor: Maybe<Scalars['String']>
  readonly hits: ReadonlyArray<SearchHitPackage>
}

export interface PackagesSearchStats {
  readonly __typename: 'PackagesSearchStats'
  readonly modified: DatetimeExtents
  readonly size: NumberExtents
  readonly entries: NumberExtents
  readonly workflow: KeywordExtents
  readonly userMeta: ReadonlyArray<PackageUserMetaFacet>
  readonly userMetaTruncated: Scalars['Boolean']
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
  readonly me: Maybe<Me>
  readonly config: Config
  readonly bucketConfigs: ReadonlyArray<BucketConfig>
  readonly bucketConfig: Maybe<BucketConfig>
  readonly potentialCollaborators: ReadonlyArray<Collaborator>
  readonly packages: Maybe<PackageList>
  readonly package: Maybe<Package>
  readonly searchObjects: ObjectsSearchResult
  readonly searchPackages: PackagesSearchResult
  readonly searchMoreObjects: ObjectsSearchMoreResult
  readonly searchMorePackages: PackagesSearchMoreResult
  readonly subscription: SubscriptionState
  readonly bucketAccessCounts: Maybe<BucketAccessCounts>
  readonly objectAccessCounts: Maybe<AccessCounts>
  readonly admin: AdminQueries
  readonly policies: ReadonlyArray<Policy>
  readonly policy: Maybe<Policy>
  readonly roles: ReadonlyArray<Role>
  readonly role: Maybe<Role>
  readonly defaultRole: Maybe<Role>
  readonly status: StatusResult
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

export interface QuerysearchObjectsArgs {
  buckets: Maybe<ReadonlyArray<Scalars['String']>>
  searchString: Maybe<Scalars['String']>
  filter: Maybe<ObjectsSearchFilter>
}

export interface QuerysearchPackagesArgs {
  buckets: Maybe<ReadonlyArray<Scalars['String']>>
  searchString: Maybe<Scalars['String']>
  filter: Maybe<PackagesSearchFilter>
  userMetaFilters: Maybe<ReadonlyArray<PackageUserMetaPredicate>>
  latestOnly?: Scalars['Boolean']
}

export interface QuerysearchMoreObjectsArgs {
  after: Scalars['String']
  size?: Maybe<Scalars['Int']>
}

export interface QuerysearchMorePackagesArgs {
  after: Scalars['String']
  size?: Maybe<Scalars['Int']>
}

export interface QuerybucketAccessCountsArgs {
  bucket: Scalars['String']
  window: Scalars['Int']
}

export interface QueryobjectAccessCountsArgs {
  bucket: Scalars['String']
  key: Scalars['String']
  window: Scalars['Int']
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
  | RoleNameUsedBySsoConfig
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

export interface RoleNameUsedBySsoConfig {
  readonly __typename: 'RoleNameUsedBySsoConfig'
  readonly _: Maybe<Scalars['Boolean']>
}

export type RoleSetDefaultResult =
  | RoleSetDefaultSuccess
  | RoleDoesNotExist
  | SsoConfigConflict

export interface RoleSetDefaultSuccess {
  readonly __typename: 'RoleSetDefaultSuccess'
  readonly role: Role
}

export type RoleUpdateResult =
  | RoleUpdateSuccess
  | RoleNameReserved
  | RoleNameExists
  | RoleNameInvalid
  | RoleNameUsedBySsoConfig
  | RoleIsManaged
  | RoleIsUnmanaged
  | RoleHasTooManyPoliciesToAttach

export interface RoleUpdateSuccess {
  readonly __typename: 'RoleUpdateSuccess'
  readonly role: Role
}

export interface SearchHitObject {
  readonly __typename: 'SearchHitObject'
  readonly id: Scalars['ID']
  readonly score: Scalars['Float']
  readonly bucket: Scalars['String']
  readonly key: Scalars['String']
  readonly version: Scalars['String']
  readonly size: Scalars['Float']
  readonly modified: Scalars['Datetime']
  readonly deleted: Scalars['Boolean']
  readonly indexedContent: Maybe<Scalars['String']>
}

export interface SearchHitPackage {
  readonly __typename: 'SearchHitPackage'
  readonly id: Scalars['ID']
  readonly score: Scalars['Float']
  readonly bucket: Scalars['String']
  readonly name: Scalars['String']
  readonly pointer: Scalars['String']
  readonly hash: Scalars['String']
  readonly size: Scalars['Float']
  readonly modified: Scalars['Datetime']
  readonly totalEntriesCount: Scalars['Int']
  readonly comment: Maybe<Scalars['String']>
  readonly meta: Maybe<Scalars['String']>
  readonly workflow: Maybe<Scalars['JsonRecord']>
  readonly matchLocations: SearchHitPackageMatchLocations
  readonly matchingEntries: ReadonlyArray<SearchHitPackageMatchingEntry>
}

export interface SearchHitPackageEntryMatchLocations {
  readonly __typename: 'SearchHitPackageEntryMatchLocations'
  readonly logicalKey: Scalars['Boolean']
  readonly physicalKey: Scalars['Boolean']
  readonly meta: Scalars['Boolean']
  readonly contents: Scalars['Boolean']
}

export interface SearchHitPackageMatchLocations {
  readonly __typename: 'SearchHitPackageMatchLocations'
  readonly name: Scalars['Boolean']
  readonly comment: Scalars['Boolean']
  readonly meta: Scalars['Boolean']
  readonly workflow: Scalars['Boolean']
}

export interface SearchHitPackageMatchingEntry {
  readonly __typename: 'SearchHitPackageMatchingEntry'
  readonly logicalKey: Scalars['String']
  readonly physicalKey: Scalars['String']
  readonly size: Scalars['Float']
  readonly meta: Maybe<Scalars['String']>
  readonly matchLocations: SearchHitPackageEntryMatchLocations
}

export enum SearchResultOrder {
  BEST_MATCH = 'BEST_MATCH',
  NEWEST = 'NEWEST',
  OLDEST = 'OLDEST',
  LEX_ASC = 'LEX_ASC',
  LEX_DESC = 'LEX_DESC',
}

export type SetSsoConfigResult = SsoConfig | InvalidInput | OperationError

export interface SnsInvalid {
  readonly __typename: 'SnsInvalid'
  readonly _: Maybe<Scalars['Boolean']>
}

export enum SortDirection {
  ASC = 'ASC',
  DESC = 'DESC',
}

export interface SsoConfig {
  readonly __typename: 'SsoConfig'
  readonly text: Scalars['String']
  readonly timestamp: Scalars['Datetime']
  readonly uploader: User
}

export interface SsoConfigConflict {
  readonly __typename: 'SsoConfigConflict'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface Status {
  readonly __typename: 'Status'
  readonly canaries: ReadonlyArray<Canary>
  readonly latestStats: TestStats
  readonly stats: TestStatsTimeSeries
  readonly reports: StatusReportList
  readonly reportsBucket: Scalars['String']
}

export interface StatusstatsArgs {
  window?: Maybe<Scalars['Int']>
}

export interface StatusreportsArgs {
  filter: Maybe<StatusReportListFilter>
}

export interface StatusReport {
  readonly __typename: 'StatusReport'
  readonly timestamp: Scalars['Datetime']
  readonly renderedReportLocation: Scalars['S3ObjectLocation']
}

export interface StatusReportList {
  readonly __typename: 'StatusReportList'
  readonly total: Scalars['Int']
  readonly page: ReadonlyArray<StatusReport>
}

export interface StatusReportListpageArgs {
  number?: Scalars['Int']
  perPage?: Scalars['Int']
  order?: StatusReportListOrder
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

export interface SubscriptionInvalid {
  readonly __typename: 'SubscriptionInvalid'
  readonly _: Maybe<Scalars['Boolean']>
}

export interface SubscriptionState {
  readonly __typename: 'SubscriptionState'
  readonly active: Scalars['Boolean']
  readonly timestamp: Scalars['Datetime']
}

export type SwitchRoleResult = Me | InvalidInput | OperationError

export interface TabulatorOpenQueryResult {
  readonly __typename: 'TabulatorOpenQueryResult'
  readonly tabulatorOpenQuery: Scalars['Boolean']
}

export interface TabulatorTable {
  readonly __typename: 'TabulatorTable'
  readonly name: Scalars['String']
  readonly config: Scalars['String']
}

export interface TestStats {
  readonly __typename: 'TestStats'
  readonly passed: Scalars['Int']
  readonly failed: Scalars['Int']
  readonly running: Scalars['Int']
}

export interface TestStatsTimeSeries {
  readonly __typename: 'TestStatsTimeSeries'
  readonly datetimes: ReadonlyArray<Scalars['Datetime']>
  readonly passed: ReadonlyArray<Scalars['Int']>
  readonly failed: ReadonlyArray<Scalars['Int']>
}

export interface TextPackageUserMetaFacet extends IPackageUserMetaFacet {
  readonly __typename: 'TextPackageUserMetaFacet'
  readonly path: Scalars['String']
}

export interface TextSearchPredicate {
  readonly queryString: Scalars['String']
}

export interface Unavailable {
  readonly __typename: 'Unavailable'
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

export interface User {
  readonly __typename: 'User'
  readonly name: Scalars['String']
  readonly email: Scalars['String']
  readonly dateJoined: Scalars['Datetime']
  readonly lastLogin: Scalars['Datetime']
  readonly isActive: Scalars['Boolean']
  readonly isAdmin: Scalars['Boolean']
  readonly isSsoOnly: Scalars['Boolean']
  readonly isService: Scalars['Boolean']
  readonly role: Maybe<Role>
  readonly extraRoles: ReadonlyArray<Role>
  readonly isRoleAssignmentDisabled: Scalars['Boolean']
  readonly isAdminAssignmentDisabled: Scalars['Boolean']
}

export interface UserAdminMutations {
  readonly __typename: 'UserAdminMutations'
  readonly create: UserResult
  readonly mutate: Maybe<MutateUserAdminMutations>
}

export interface UserAdminMutationscreateArgs {
  input: UserInput
}

export interface UserAdminMutationsmutateArgs {
  name: Scalars['String']
}

export interface UserAdminQueries {
  readonly __typename: 'UserAdminQueries'
  readonly list: ReadonlyArray<User>
  readonly get: Maybe<User>
}

export interface UserAdminQueriesgetArgs {
  name: Scalars['String']
}

export interface UserInput {
  readonly name: Scalars['String']
  readonly email: Scalars['String']
  readonly role: Scalars['String']
  readonly extraRoles: Maybe<ReadonlyArray<Scalars['String']>>
}

export type UserResult = User | InvalidInput | OperationError
