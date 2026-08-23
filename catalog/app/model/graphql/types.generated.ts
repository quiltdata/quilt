import type { Json } from 'utils/types'
import type { JsonRecord } from 'utils/types'
import type { PackageContentsFlatMap } from 'model'
import type { S3ObjectLocation } from 'model/S3'
export type Maybe<T> = T | null
export type InputMaybe<T> = Maybe<T>
/** All built-in and custom scalars, mapped to their actual values */
export interface Scalars {
  ID: { input: string; output: string }
  String: { input: string; output: string }
  Boolean: { input: boolean; output: boolean }
  Int: { input: number; output: number }
  Float: { input: number; output: number }
  Datetime: { input: Date; output: Date }
  Json: { input: Json; output: Json }
  JsonRecord: { input: JsonRecord; output: JsonRecord }
  PackageContentsFlatMap: {
    input: PackageContentsFlatMap
    output: PackageContentsFlatMap
  }
  /**
   * A package ordering expression (packages `firstPage(ordering:)`). Nullable: null
   * or absent = relevance (_score). Otherwise one expression, no combinations:
   *
   *     expression := system | usermeta
   *     system     := "sys:" field ":" dir
   *     usermeta   := "usr:" pointer ":" type ":" dir
   *
   *     field      := "name" | "modified" | "size" | "entries" | "hash"
   *                 | "workflow" | "comment"
   *     pointer    := a JSON pointer (RFC 6901), e.g. /experiment/date
   *     type       := "number" | "datetime" | "keyword" | "text" | "boolean"
   *     dir        := "asc" | "desc"
   *
   * `type` names a FACET type, not a raw storage type — the registry maps it to the
   * stored subfield privately. `text` is contingent best-effort: it sorts a pointer's
   * keyword-backed storage and is rejected (as unsupported) when only analyzed text
   * is stored.
   *
   * The prefix is `usr:` (not `user:`). `usr:` is parsed RIGHT-anchored — a JSON
   * pointer may itself contain `:`, so the last two `:`-segments are the type and
   * dir, and everything between `usr:` and `:<type>:<dir>` is the pointer, verbatim.
   * `sys:` is a closed field set, parsed left-to-right. All tokens are lowercase and
   * exact: no trimming, no aliases, no case-folding. A non-string wire value (a
   * mistyped variable or inline literal) is unparseable.
   *
   * Examples: `sys:modified:desc` · `sys:name:asc` · `usr:/experiment/date:datetime:asc`
   * · null (relevance).
   *
   * Two rejection classes, both surfaced as the typed InvalidInput arm of
   * PackagesFirstPageResult (never a GraphQLError, never a silent _score fallback):
   *   - unparseable — fails the grammar (bad prefix, wrong arity, unknown
   *     field/type/dir, non-lowercase, non-string); name `ordering`, message quotes
   *     the grammar;
   *   - unsupported — well-formed but unhonorable: `comment` (no keyword subfield
   *     yet), a `text` pointer with no keyword-backed storage, or a TYPE MISMATCH
   *     where the type's mapped storage type is not among the pointer's indexed
   *     stored types (membership-validated against the facet mapping, never
   *     inferred); name `UnsupportedSort`, message states the reason.
   */
  PackageOrdering: { input: string; output: string }
  S3ObjectLocation: { input: S3ObjectLocation; output: S3ObjectLocation }
}

export interface APIKey {
  readonly __typename: 'APIKey'
  readonly createdAt: Scalars['Datetime']['output']
  readonly expiresAt: Scalars['Datetime']['output']
  readonly fingerprint: Scalars['String']['output']
  readonly id: Scalars['ID']['output']
  readonly lastUsedAt: Maybe<Scalars['Datetime']['output']>
  readonly name: Scalars['String']['output']
  readonly status: APIKeyStatus
  readonly userEmail: Scalars['String']['output']
}

export interface APIKeyAdminMutations {
  readonly __typename: 'APIKeyAdminMutations'
  readonly revoke: APIKeyRevokeResult
}

export interface APIKeyAdminMutationsrevokeArgs {
  id: Scalars['ID']['input']
}

export interface APIKeyAdminQueries {
  readonly __typename: 'APIKeyAdminQueries'
  readonly get: Maybe<APIKey>
  readonly list: ReadonlyArray<APIKey>
}

export interface APIKeyAdminQueriesgetArgs {
  id: Scalars['ID']['input']
}

export interface APIKeyAdminQuerieslistArgs {
  email: InputMaybe<Scalars['String']['input']>
  fingerprint: InputMaybe<Scalars['String']['input']>
  name: InputMaybe<Scalars['String']['input']>
  status: InputMaybe<APIKeyStatus>
}

export interface APIKeyCreateInput {
  readonly expiresInDays: Scalars['Int']['input']
  readonly name: Scalars['String']['input']
}

export type APIKeyCreateResult = APIKeyCreated | InvalidInput

export interface APIKeyCreated {
  readonly __typename: 'APIKeyCreated'
  readonly apiKey: APIKey
  readonly secret: Scalars['String']['output']
}

export type APIKeyRevokeResult = InvalidInput | Ok

export enum APIKeyStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
}

export interface AccessCountForDate {
  readonly __typename: 'AccessCountForDate'
  readonly date: Scalars['Datetime']['output']
  readonly value: Scalars['Int']['output']
}

export interface AccessCounts {
  readonly __typename: 'AccessCounts'
  readonly counts: ReadonlyArray<AccessCountForDate>
  readonly total: Scalars['Int']['output']
}

export interface AccessCountsGroup {
  readonly __typename: 'AccessCountsGroup'
  readonly counts: AccessCounts
  readonly ext: Scalars['String']['output']
}

export interface AdminMutations {
  readonly __typename: 'AdminMutations'
  readonly apiKeys: APIKeyAdminMutations
  /** @deprecated Field no longer supported */
  readonly bucketRenameTabulatorTable: BucketSetTabulatorTableResult
  /** @deprecated Field no longer supported */
  readonly bucketSetTabulatorTable: BucketSetTabulatorTableResult
  readonly dataProducts: DataProductAdminMutations
  readonly packager: PackagerAdminMutations
  readonly setSsoConfig: Maybe<SetSsoConfigResult>
  readonly setTabulatorOpenQuery: TabulatorOpenQueryResult
  readonly user: UserAdminMutations
}

export interface AdminMutationsbucketRenameTabulatorTableArgs {
  bucketName: Scalars['String']['input']
  newTableName: Scalars['String']['input']
  tableName: Scalars['String']['input']
}

export interface AdminMutationsbucketSetTabulatorTableArgs {
  bucketName: Scalars['String']['input']
  config: InputMaybe<Scalars['String']['input']>
  tableName: Scalars['String']['input']
}

export interface AdminMutationssetSsoConfigArgs {
  config: InputMaybe<Scalars['String']['input']>
}

export interface AdminMutationssetTabulatorOpenQueryArgs {
  enabled: Scalars['Boolean']['input']
}

export interface AdminQueries {
  readonly __typename: 'AdminQueries'
  readonly apiKeys: APIKeyAdminQueries
  readonly isDefaultRoleSettingDisabled: Scalars['Boolean']['output']
  readonly packager: PackagerAdminQueries
  readonly ssoConfig: Maybe<SsoConfig>
  readonly tabulatorOpenQuery: Scalars['Boolean']['output']
  readonly user: UserAdminQueries
}

export interface BooleanPackageUserMetaFacet extends IPackageUserMetaFacet {
  readonly __typename: 'BooleanPackageUserMetaFacet'
  readonly path: Scalars['String']['output']
  readonly sortable: Scalars['Boolean']['output']
}

export interface BooleanSearchPredicate {
  readonly false: InputMaybe<Scalars['Boolean']['input']>
  readonly true: InputMaybe<Scalars['Boolean']['input']>
}

export interface BrowsingSession {
  readonly __typename: 'BrowsingSession'
  readonly expires: Scalars['Datetime']['output']
  readonly id: Scalars['ID']['output']
}

export type BrowsingSessionCreateResult = BrowsingSession | InvalidInput | OperationError

export type BrowsingSessionDisposeResult = Ok | OperationError

export type BrowsingSessionRefreshResult = BrowsingSession | InvalidInput | OperationError

export interface Bucket {
  readonly __typename: 'Bucket'
  readonly browsable: Scalars['Boolean']['output']
  readonly collaborators: ReadonlyArray<CollaboratorBucketConnection>
  readonly description: Maybe<Scalars['String']['output']>
  readonly iconUrl: Maybe<Scalars['String']['output']>
  readonly name: Scalars['String']['output']
  readonly relevanceScore: Scalars['Int']['output']
  readonly tags: Maybe<ReadonlyArray<Scalars['String']['output']>>
  readonly title: Scalars['String']['output']
}

export interface BucketAccessCounts {
  readonly __typename: 'BucketAccessCounts'
  readonly byExt: ReadonlyArray<AccessCountsGroup>
  readonly combined: AccessCounts
}

export interface BucketAccessCountsbyExtArgs {
  groups: InputMaybe<Scalars['Int']['input']>
}

export interface BucketAddInput {
  readonly browsable: InputMaybe<Scalars['Boolean']['input']>
  readonly delayScan: InputMaybe<Scalars['Boolean']['input']>
  readonly description: InputMaybe<Scalars['String']['input']>
  readonly fileExtensionsToIndex: InputMaybe<ReadonlyArray<Scalars['String']['input']>>
  readonly iconUrl: InputMaybe<Scalars['String']['input']>
  readonly indexContentBytes: InputMaybe<Scalars['Int']['input']>
  readonly linkedData: InputMaybe<Scalars['Json']['input']>
  readonly name: Scalars['String']['input']
  readonly overviewUrl: InputMaybe<Scalars['String']['input']>
  readonly prefixes: InputMaybe<ReadonlyArray<Scalars['String']['input']>>
  readonly relevanceScore: InputMaybe<Scalars['Int']['input']>
  readonly scannerParallelShardsDepth: InputMaybe<Scalars['Int']['input']>
  readonly skipMetaDataIndexing: InputMaybe<Scalars['Boolean']['input']>
  readonly snsNotificationArn: InputMaybe<Scalars['String']['input']>
  readonly tags: InputMaybe<ReadonlyArray<Scalars['String']['input']>>
  readonly title: Scalars['String']['input']
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
  readonly _: Maybe<Scalars['Boolean']['output']>
}

export interface BucketConfig {
  readonly __typename: 'BucketConfig'
  readonly associatedPolicies: ReadonlyArray<PolicyBucketPermission>
  readonly associatedRoles: ReadonlyArray<RoleBucketPermission>
  readonly browsable: Scalars['Boolean']['output']
  readonly description: Maybe<Scalars['String']['output']>
  readonly fileExtensionsToIndex: Maybe<ReadonlyArray<Scalars['String']['output']>>
  readonly iconUrl: Maybe<Scalars['String']['output']>
  readonly indexContentBytes: Maybe<Scalars['Int']['output']>
  readonly lastIndexed: Maybe<Scalars['Datetime']['output']>
  readonly linkedData: Maybe<Scalars['Json']['output']>
  readonly name: Scalars['String']['output']
  readonly overviewUrl: Maybe<Scalars['String']['output']>
  readonly prefixes: ReadonlyArray<Scalars['String']['output']>
  readonly relevanceScore: Scalars['Int']['output']
  readonly scannerParallelShardsDepth: Maybe<Scalars['Int']['output']>
  readonly skipMetaDataIndexing: Maybe<Scalars['Boolean']['output']>
  readonly snsNotificationArn: Maybe<Scalars['String']['output']>
  readonly tabulatorTables: ReadonlyArray<TabulatorTable>
  readonly tags: Maybe<ReadonlyArray<Scalars['String']['output']>>
  readonly title: Scalars['String']['output']
}

export interface BucketDoesNotExist {
  readonly __typename: 'BucketDoesNotExist'
  readonly _: Maybe<Scalars['Boolean']['output']>
}

export interface BucketFileExtensionsToIndexInvalid {
  readonly __typename: 'BucketFileExtensionsToIndexInvalid'
  readonly _: Maybe<Scalars['Boolean']['output']>
}

export interface BucketIndexContentBytesInvalid {
  readonly __typename: 'BucketIndexContentBytesInvalid'
  readonly _: Maybe<Scalars['Boolean']['output']>
}

export interface BucketNotFound {
  readonly __typename: 'BucketNotFound'
  readonly _: Maybe<Scalars['Boolean']['output']>
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
  readonly _: Maybe<Scalars['Boolean']['output']>
}

export type BucketSetTabulatorTableResult = BucketConfig | InvalidInput | OperationError

export interface BucketUpdateInput {
  readonly browsable: InputMaybe<Scalars['Boolean']['input']>
  readonly description: InputMaybe<Scalars['String']['input']>
  readonly fileExtensionsToIndex: InputMaybe<ReadonlyArray<Scalars['String']['input']>>
  readonly iconUrl: InputMaybe<Scalars['String']['input']>
  readonly indexContentBytes: InputMaybe<Scalars['Int']['input']>
  readonly linkedData: InputMaybe<Scalars['Json']['input']>
  readonly overviewUrl: InputMaybe<Scalars['String']['input']>
  readonly prefixes: InputMaybe<ReadonlyArray<Scalars['String']['input']>>
  readonly relevanceScore: InputMaybe<Scalars['Int']['input']>
  readonly scannerParallelShardsDepth: InputMaybe<Scalars['Int']['input']>
  readonly skipMetaDataIndexing: InputMaybe<Scalars['Boolean']['input']>
  readonly snsNotificationArn: InputMaybe<Scalars['String']['input']>
  readonly tags: InputMaybe<ReadonlyArray<Scalars['String']['input']>>
  readonly title: Scalars['String']['input']
}

export type BucketUpdateResult =
  | BucketFileExtensionsToIndexInvalid
  | BucketIndexContentBytesInvalid
  | BucketNotFound
  | BucketUpdateSuccess
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
  readonly description: Scalars['String']['output']
  readonly group: Scalars['String']['output']
  readonly lastRun: Maybe<Scalars['Datetime']['output']>
  readonly name: Scalars['String']['output']
  readonly ok: Maybe<Scalars['Boolean']['output']>
  readonly region: Scalars['String']['output']
  readonly schedule: Scalars['String']['output']
  readonly title: Scalars['String']['output']
}

export interface Collaborator {
  readonly __typename: 'Collaborator'
  readonly email: Scalars['String']['output']
  readonly username: Scalars['String']['output']
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
  readonly bytesDefault: Scalars['Int']['output']
  readonly bytesMax: Scalars['Int']['output']
  readonly bytesMin: Scalars['Int']['output']
  readonly extensions: ReadonlyArray<Scalars['String']['output']>
}

export interface DataProduct {
  readonly __typename: 'DataProduct'
  readonly binding: DataProductBinding
  /**
   * Null where the platform has no curation concept at all (DataZone, Snowflake)
   * *and* where it has one but nothing is set (Unity). Those are different facts;
   * the client distinguishes them via the platform's declared capabilities.
   */
  readonly curationStatus: Maybe<Scalars['String']['output']>
  readonly description: Maybe<Scalars['String']['output']>
  /**
   * When Quilt last looked. Never a sync guarantee: no platform emits
   * product-level change events, so composition can change with nothing emitted.
   */
  readonly fetchedAt: Scalars['Datetime']['output']
  /**
   * Who has been granted access. Deliberately not a per-user verdict: "can Alice
   * read this" is undecidable, since row-policy bodies can call external
   * functions. Do not add a `whoHasAccess(user:)` field — it cannot be answered
   * honestly on any of the three platforms.
   */
  readonly grants: ReadonlyArray<DataProductGrant>
  /**
   * Synthesized from the binding, and **not stable across renames** — a Unity
   * schema rename changes it and emits no event. A miss on lookup is ordinary
   * drift, not a bad request.
   */
  readonly id: Scalars['ID']['output']
  readonly labels: ReadonlyArray<Scalars['String']['output']>
  readonly members: ReadonlyArray<DataProductMember>
  readonly name: Scalars['String']['output']
  readonly owningEntity: Maybe<DataProductOwner>
  readonly platform: DataProductPlatform
  readonly policyFlags: DataProductPolicyFlags
}

export interface DataProductAdminMutations {
  readonly __typename: 'DataProductAdminMutations'
  readonly connectionAdd: DataProductConnectionResult
  /** Attempt a read against the connection and record the outcome in `state`. */
  readonly connectionCheck: DataProductConnectionResult
  readonly connectionRemove: OperationResult
  readonly connectionUpdate: DataProductConnectionResult
}

export interface DataProductAdminMutationsconnectionAddArgs {
  input: DataProductConnectionAddInput
}

export interface DataProductAdminMutationsconnectionCheckArgs {
  id: Scalars['ID']['input']
}

export interface DataProductAdminMutationsconnectionRemoveArgs {
  id: Scalars['ID']['input']
}

export interface DataProductAdminMutationsconnectionUpdateArgs {
  id: Scalars['ID']['input']
  input: DataProductConnectionUpdateInput
}

export enum DataProductAuthMethod {
  API_KEY = 'API_KEY',
  /** SigV4 via an assumed role. The only option for DataZone/Lake Formation. */
  IAM_ROLE = 'IAM_ROLE',
  /** Machine-to-machine OAuth, service-principal style. */
  OAUTH_M2M = 'OAUTH_M2M',
  /**
   * User-to-machine OAuth, acting as the signed-in person. Databricks documents a
   * browser-capable PKCE flow; whether Quilt brokers the exchange is a separate
   * question from whether this connection declares the method.
   */
  OAUTH_U2M = 'OAUTH_U2M',
}

export interface DataProductBeneficiary {
  readonly __typename: 'DataProductBeneficiary'
  readonly label: Scalars['String']['output']
  readonly type: DataProductPrincipalType
}

/**
 * How to address a product in its own catalog. A union rather than a bag of
 * nullable fields so an impossible combination (a Snowflake listing carrying a
 * metastore) cannot be expressed.
 */
export type DataProductBinding =
  | DataZoneBinding
  | SnowflakeListingBinding
  | UnitySchemaBinding
  | UnityShareBinding

export interface DataProductColumn {
  readonly __typename: 'DataProductColumn'
  readonly description: Maybe<Scalars['String']['output']>
  readonly name: Scalars['String']['output']
  /** Platform-native type string. Not normalized — platforms disagree. */
  readonly type: Scalars['String']['output']
}

export interface DataProductConnection {
  readonly __typename: 'DataProductConnection'
  readonly authMethod: DataProductAuthMethod
  /**
   * Where to reach it: a DataZone domain id, a Unity workspace host, a Snowflake
   * account locator. Shape depends on `platform`; opaque here on purpose so adding
   * a platform does not reshape this type.
   */
  readonly endpoint: Scalars['String']['output']
  readonly id: Scalars['ID']['output']
  readonly lastCheckedAt: Maybe<Scalars['Datetime']['output']>
  readonly platform: DataProductPlatform
  /**
   * Pointer to where the credential actually lives. Never the credential. Null
   * when the method needs none (an instance role, say).
   */
  readonly secretRef: Maybe<Scalars['String']['output']>
  readonly state: DataProductConnectionState
  readonly statusMessage: Maybe<Scalars['String']['output']>
  /** Admin-facing label. Not an identifier. */
  readonly title: Scalars['String']['output']
}

export interface DataProductConnectionAddInput {
  readonly authMethod: DataProductAuthMethod
  readonly endpoint: Scalars['String']['input']
  readonly platform: DataProductPlatform
  readonly secretRef: InputMaybe<Scalars['String']['input']>
  readonly title: Scalars['String']['input']
}

export type DataProductConnectionResult =
  | DataProductConnection
  | InvalidInput
  | OperationError

export enum DataProductConnectionState {
  /** Last check failed — see `statusMessage`. */
  ERROR = 'ERROR',
  /** Configured and last check succeeded. */
  READY = 'READY',
  /** Configured but never verified, or verification is pending. */
  UNVERIFIED = 'UNVERIFIED',
}

export interface DataProductConnectionUpdateInput {
  readonly authMethod: InputMaybe<DataProductAuthMethod>
  readonly endpoint: InputMaybe<Scalars['String']['input']>
  readonly secretRef: InputMaybe<Scalars['String']['input']>
  readonly title: InputMaybe<Scalars['String']['input']>
}

/**
 * Where a member's contents come from, and therefore whose governance covers them.
 * `CATALOG` means the catalog enumerates it and its row/column rules apply.
 * `DIRECT_S3` means the catalog gave only a location (a bucket ARN), so Quilt lists
 * S3 itself and the catalog's rules do **not** cover the listing. `UNAVAILABLE`
 * means it could not be listed at all — distinct from a permission answer.
 *
 * Non-null deliberately: a default would let the governed and ungoverned cases
 * render identically, which is the one distinction this type exists to preserve.
 */
export enum DataProductContentsSource {
  CATALOG = 'CATALOG',
  DIRECT_S3 = 'DIRECT_S3',
  UNAVAILABLE = 'UNAVAILABLE',
}

export interface DataProductGrant {
  readonly __typename: 'DataProductGrant'
  /**
   * Verbatim platform privilege (`SELECT`, `READ VOLUME`, `USE CATALOG`).
   * Mandatory, not decorative: Unity needs a *conjunction* of three grants for one
   * read, and normalizing to READ discards why a user can or cannot read.
   */
  readonly nativePrivilege: Scalars['String']['output']
  /** `UNKNOWN` where the platform cannot resolve it, never guessed. */
  readonly origin: DataProductGrantOrigin
  /** Display string as the platform reports it — not a stable id. */
  readonly principal: Scalars['String']['output']
  readonly principalType: DataProductPrincipalType
  readonly privilege: DataProductPrivilege
}

export enum DataProductGrantOrigin {
  DIRECT = 'DIRECT',
  INHERITED = 'INHERITED',
  UNKNOWN = 'UNKNOWN',
}

export interface DataProductMember {
  readonly __typename: 'DataProductMember'
  readonly contentsSource: DataProductContentsSource
  readonly kind: DataProductMemberKind
  readonly logicalName: Scalars['String']['output']
  /** Whether the current user can read it. Discovery and readability differ. */
  readonly readable: Scalars['Boolean']['output']
  /**
   * Null is three different facts depending on platform: a fileset has no columns
   * by nature, and DataZone hides tabular columns inside an opaque forms string.
   * Read it through `DataProduct.platform` rather than as "no columns".
   */
  readonly schema: Maybe<ReadonlyArray<DataProductColumn>>
  readonly sizeBytes: Maybe<Scalars['Float']['output']>
}

export enum DataProductMemberKind {
  FILESET = 'FILESET',
  TABLE = 'TABLE',
  VIEW = 'VIEW',
}

export interface DataProductOwner {
  readonly __typename: 'DataProductOwner'
  /**
   * True when the value was derived rather than reported. DataZone has no
   * per-product owner API (`ListEntityOwners` takes DOMAIN_UNIT only), so a human
   * name there is inferred from project membership.
   */
  readonly derived: Scalars['Boolean']['output']
  readonly kind: DataProductOwnerKind
  readonly label: Scalars['String']['output']
}

export enum DataProductOwnerKind {
  PRINCIPAL = 'PRINCIPAL',
  PROJECT = 'PROJECT',
}

export enum DataProductPlatform {
  DATAZONE = 'DATAZONE',
  SNOWFLAKE_LISTING = 'SNOWFLAKE_LISTING',
  UNITY_SCHEMA = 'UNITY_SCHEMA',
  UNITY_SHARE = 'UNITY_SHARE',
}

export interface DataProductPlatformRecord {
  readonly __typename: 'DataProductPlatformRecord'
  /** Native id, e.g. a DataZone subscription request id. */
  readonly id: Scalars['String']['output']
  /** A read timestamp, not a sync guarantee. */
  readonly reconciledAt: Scalars['Datetime']['output']
}

export interface DataProductPolicyFlags {
  readonly __typename: 'DataProductPolicyFlags'
  readonly columnMask: DataProductPolicyPresence
  readonly rowLevel: DataProductPolicyPresence
}

/**
 * Three states, because absence is not a guarantee. Snowflake's
 * `POLICY_REFERENCES` is privilege-filtered, so a caller without APPLY/OWNERSHIP
 * sees nothing — `NOT_VISIBLE` says "we cannot tell", which must never render as
 * "no policy exists".
 */
export enum DataProductPolicyPresence {
  NOT_VISIBLE = 'NOT_VISIBLE',
  PRESENT = 'PRESENT',
  UNKNOWN = 'UNKNOWN',
}

export enum DataProductPrincipalType {
  GROUP = 'GROUP',
  PROJECT = 'PROJECT',
  RECIPIENT = 'RECIPIENT',
  ROLE = 'ROLE',
  SERVICE_PRINCIPAL = 'SERVICE_PRINCIPAL',
  UNKNOWN = 'UNKNOWN',
  USER = 'USER',
}

export enum DataProductPrivilege {
  BROWSE = 'BROWSE',
  MANAGE = 'MANAGE',
  READ = 'READ',
  UNKNOWN = 'UNKNOWN',
  WRITE = 'WRITE',
}

/**
 * The request record is **Quilt's**, not the catalog's. Only DataZone can
 * enumerate pending requests, so a queue that depended on the platform would exist
 * on one installation in three; platform state is reconciled in as enrichment.
 *
 * No expiry field: no target platform enforces time-bounded access, and an
 * unenforceable expiry reads as a security boundary while being decoration.
 */
export interface DataProductRequest {
  readonly __typename: 'DataProductRequest'
  /**
   * Who the access lands on, which is routinely not the requester — a DataZone
   * subscription is held by a project, so approving one person's request grants
   * the whole project.
   */
  readonly beneficiary: DataProductBeneficiary
  readonly createdAt: Scalars['Datetime']['output']
  readonly dataProductId: Scalars['ID']['output']
  readonly id: Scalars['ID']['output']
  /** Null where the platform cannot be asked — a steady state on Unity. */
  readonly platformRecord: Maybe<DataProductPlatformRecord>
  readonly reason: Scalars['String']['output']
  readonly requestedBy: Scalars['String']['output']
  /**
   * Whether a revoke left live permissions behind. Only meaningful when status is
   * REVOKED. DataZone's revoke takes `retainPermissions`, and when true the
   * underlying Lake Formation grants remain in force while DataZone stops managing
   * them. Null means undetermined, which must read as possibly-still-granted.
   */
  readonly retainedPermissions: Maybe<Scalars['Boolean']['output']>
  readonly status: DataProductRequestStatus
}

/**
 * `SUBMITTED` and `PENDING` are different states, not styling: SUBMITTED means
 * Quilt holds the record and the catalog has not acknowledged it (or cannot be
 * asked), PENDING means the catalog reports it awaiting a decision.
 */
export enum DataProductRequestStatus {
  APPROVED = 'APPROVED',
  CANCELLED = 'CANCELLED',
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
  REVOKED = 'REVOKED',
  SUBMITTED = 'SUBMITTED',
  UNKNOWN = 'UNKNOWN',
}

export interface DataProductRequestSubmitInput {
  readonly beneficiaryLabel: Scalars['String']['input']
  readonly beneficiaryType: DataProductPrincipalType
  readonly dataProductId: Scalars['ID']['input']
  readonly reason: Scalars['String']['input']
}

export type DataProductRequestSubmitResult =
  | DataProductRequest
  | InvalidInput
  | OperationError

export interface DataZoneBinding {
  readonly __typename: 'DataZoneBinding'
  readonly domainId: Scalars['String']['output']
  readonly entityId: Maybe<Scalars['String']['output']>
  readonly listingId: Scalars['String']['output']
}

export interface DatetimeExtents {
  readonly __typename: 'DatetimeExtents'
  readonly max: Scalars['Datetime']['output']
  readonly min: Scalars['Datetime']['output']
}

export interface DatetimePackageUserMetaFacet extends IPackageUserMetaFacet {
  readonly __typename: 'DatetimePackageUserMetaFacet'
  readonly extents: DatetimeExtents
  readonly path: Scalars['String']['output']
  readonly sortable: Scalars['Boolean']['output']
}

export interface DatetimeSearchPredicate {
  readonly gte: InputMaybe<Scalars['Datetime']['input']>
  readonly lte: InputMaybe<Scalars['Datetime']['input']>
}

export interface EmptySearchResultSet {
  readonly __typename: 'EmptySearchResultSet'
  readonly _: Maybe<Scalars['Boolean']['output']>
}

export enum GlacierRestoreTier {
  BULK = 'BULK',
  EXPEDITED = 'EXPEDITED',
  STANDARD = 'STANDARD',
}

export interface IPackageUserMetaFacet {
  readonly path: Scalars['String']['output']
  /**
   * Whether ES can sort on this pointer's stored subfield. Independent of the
   * concrete facet type: a high-cardinality keyword is rendered as a
   * TextPackageUserMetaFacet (no bounded value picker) yet is `sortable: true`.
   */
  readonly sortable: Scalars['Boolean']['output']
}

export interface IndexingInProgress {
  readonly __typename: 'IndexingInProgress'
  readonly _: Maybe<Scalars['Boolean']['output']>
}

export interface InputError {
  readonly __typename: 'InputError'
  readonly context: Maybe<Scalars['JsonRecord']['output']>
  readonly message: Scalars['String']['output']
  readonly name: Scalars['String']['output']
  readonly path: Maybe<Scalars['String']['output']>
}

export interface InsufficientPermissions {
  readonly __typename: 'InsufficientPermissions'
  readonly message: Scalars['String']['output']
}

export interface InvalidInput {
  readonly __typename: 'InvalidInput'
  readonly errors: ReadonlyArray<InputError>
}

export interface KeywordExtents {
  readonly __typename: 'KeywordExtents'
  readonly values: ReadonlyArray<Scalars['String']['output']>
}

export interface KeywordPackageUserMetaFacet extends IPackageUserMetaFacet {
  readonly __typename: 'KeywordPackageUserMetaFacet'
  readonly extents: KeywordExtents
  readonly path: Scalars['String']['output']
  readonly sortable: Scalars['Boolean']['output']
}

export interface KeywordSearchPredicate {
  readonly terms: InputMaybe<ReadonlyArray<Scalars['String']['input']>>
  readonly wildcard: InputMaybe<Scalars['String']['input']>
}

export interface ManagedPolicyInput {
  readonly permissions: ReadonlyArray<PermissionInput>
  readonly roles: ReadonlyArray<Scalars['ID']['input']>
  readonly title: Scalars['String']['input']
}

export interface ManagedRole {
  readonly __typename: 'ManagedRole'
  readonly arn: Scalars['String']['output']
  readonly id: Scalars['ID']['output']
  readonly name: Scalars['String']['output']
  readonly permissions: ReadonlyArray<RoleBucketPermission>
  readonly policies: ReadonlyArray<Policy>
}

export interface ManagedRoleInput {
  readonly name: Scalars['String']['input']
  readonly policies: ReadonlyArray<Scalars['ID']['input']>
}

export interface Me {
  readonly __typename: 'Me'
  readonly apiKey: Maybe<APIKey>
  readonly apiKeys: ReadonlyArray<APIKey>
  readonly email: Scalars['String']['output']
  readonly isAdmin: Scalars['Boolean']['output']
  readonly name: Scalars['String']['output']
  readonly role: MyRole
  readonly roles: ReadonlyArray<MyRole>
}

export interface MeapiKeyArgs {
  id: Scalars['ID']['input']
}

export interface MeapiKeysArgs {
  fingerprint: InputMaybe<Scalars['String']['input']>
  name: InputMaybe<Scalars['String']['input']>
  status: InputMaybe<APIKeyStatus>
}

export interface MutateUserAdminMutations {
  readonly __typename: 'MutateUserAdminMutations'
  readonly addRoles: UserResult
  readonly delete: OperationResult
  readonly removeRoles: UserResult
  readonly resetPassword: OperationResult
  readonly setActive: UserResult
  readonly setAdmin: UserResult
  readonly setEmail: UserResult
  readonly setRole: UserResult
}

export interface MutateUserAdminMutationsaddRolesArgs {
  roles: ReadonlyArray<Scalars['String']['input']>
}

export interface MutateUserAdminMutationsremoveRolesArgs {
  fallback: InputMaybe<Scalars['String']['input']>
  roles: ReadonlyArray<Scalars['String']['input']>
}

export interface MutateUserAdminMutationssetActiveArgs {
  active: Scalars['Boolean']['input']
}

export interface MutateUserAdminMutationssetAdminArgs {
  admin: Scalars['Boolean']['input']
}

export interface MutateUserAdminMutationssetEmailArgs {
  email: Scalars['String']['input']
}

export interface MutateUserAdminMutationssetRoleArgs {
  append?: Scalars['Boolean']['input']
  extraRoles: InputMaybe<ReadonlyArray<Scalars['String']['input']>>
  role: Scalars['String']['input']
}

export interface Mutation {
  readonly __typename: 'Mutation'
  readonly admin: AdminMutations
  readonly apiKeyCreate: APIKeyCreateResult
  readonly apiKeyRevoke: APIKeyRevokeResult
  readonly browsingSessionCreate: BrowsingSessionCreateResult
  readonly browsingSessionDispose: BrowsingSessionDisposeResult
  readonly browsingSessionRefresh: BrowsingSessionRefreshResult
  readonly bucketAdd: BucketAddResult
  readonly bucketRemove: BucketRemoveResult
  readonly bucketRenameTabulatorTable: BucketSetTabulatorTableResult
  readonly bucketSetTabulatorTable: BucketSetTabulatorTableResult
  readonly bucketUpdate: BucketUpdateResult
  /**
   * Record an intention to grant. Never an approval: the catalog decides, and the
   * returned request is `SUBMITTED` at best.
   *
   * Not `@admin` — an ordinary user asks for access to a product they can see. The
   * approval happens in the owning catalog, not here.
   */
  readonly dataProductRequestSubmit: DataProductRequestSubmitResult
  readonly packageConstruct: PackageConstructResult
  readonly packagePromote: PackagePromoteResult
  readonly packageRevisionDelete: PackageRevisionDeleteResult
  readonly policyCreateManaged: PolicyResult
  readonly policyCreateUnmanaged: PolicyResult
  readonly policyDelete: PolicyDeleteResult
  readonly policyUpdateManaged: PolicyResult
  readonly policyUpdateUnmanaged: PolicyResult
  readonly restoreObject: RestoreObjectResult
  readonly roleCreateManaged: RoleCreateResult
  readonly roleCreateUnmanaged: RoleCreateResult
  readonly roleDelete: RoleDeleteResult
  readonly roleSetDefault: RoleSetDefaultResult
  readonly roleUpdateManaged: RoleUpdateResult
  readonly roleUpdateUnmanaged: RoleUpdateResult
  readonly switchRole: SwitchRoleResult
}

export interface MutationapiKeyCreateArgs {
  input: APIKeyCreateInput
}

export interface MutationapiKeyRevokeArgs {
  id: InputMaybe<Scalars['ID']['input']>
  secret: InputMaybe<Scalars['String']['input']>
}

export interface MutationbrowsingSessionCreateArgs {
  scope: Scalars['String']['input']
  ttl?: Scalars['Int']['input']
}

export interface MutationbrowsingSessionDisposeArgs {
  id: Scalars['ID']['input']
}

export interface MutationbrowsingSessionRefreshArgs {
  id: Scalars['ID']['input']
  ttl?: Scalars['Int']['input']
}

export interface MutationbucketAddArgs {
  input: BucketAddInput
}

export interface MutationbucketRemoveArgs {
  name: Scalars['String']['input']
}

export interface MutationbucketRenameTabulatorTableArgs {
  bucketName: Scalars['String']['input']
  newTableName: Scalars['String']['input']
  tableName: Scalars['String']['input']
}

export interface MutationbucketSetTabulatorTableArgs {
  bucketName: Scalars['String']['input']
  config: InputMaybe<Scalars['String']['input']>
  tableName: Scalars['String']['input']
}

export interface MutationbucketUpdateArgs {
  input: BucketUpdateInput
  name: Scalars['String']['input']
}

export interface MutationdataProductRequestSubmitArgs {
  input: DataProductRequestSubmitInput
}

export interface MutationpackageConstructArgs {
  params: PackagePushParams
  src: PackageConstructSource
}

export interface MutationpackagePromoteArgs {
  destPrefix: InputMaybe<Scalars['String']['input']>
  params: PackagePushParams
  src: PackagePromoteSource
}

export interface MutationpackageRevisionDeleteArgs {
  bucket: Scalars['String']['input']
  hash: Scalars['String']['input']
  name: Scalars['String']['input']
}

export interface MutationpolicyCreateManagedArgs {
  input: ManagedPolicyInput
}

export interface MutationpolicyCreateUnmanagedArgs {
  input: UnmanagedPolicyInput
}

export interface MutationpolicyDeleteArgs {
  id: Scalars['ID']['input']
}

export interface MutationpolicyUpdateManagedArgs {
  id: Scalars['ID']['input']
  input: ManagedPolicyInput
}

export interface MutationpolicyUpdateUnmanagedArgs {
  id: Scalars['ID']['input']
  input: UnmanagedPolicyInput
}

export interface MutationrestoreObjectArgs {
  bucket: Scalars['String']['input']
  days: Scalars['Int']['input']
  key: Scalars['String']['input']
  tier: GlacierRestoreTier
  version: InputMaybe<Scalars['String']['input']>
}

export interface MutationroleCreateManagedArgs {
  input: ManagedRoleInput
}

export interface MutationroleCreateUnmanagedArgs {
  input: UnmanagedRoleInput
}

export interface MutationroleDeleteArgs {
  id: Scalars['ID']['input']
}

export interface MutationroleSetDefaultArgs {
  id: Scalars['ID']['input']
}

export interface MutationroleUpdateManagedArgs {
  id: Scalars['ID']['input']
  input: ManagedRoleInput
}

export interface MutationroleUpdateUnmanagedArgs {
  id: Scalars['ID']['input']
  input: UnmanagedRoleInput
}

export interface MutationswitchRoleArgs {
  roleName: Scalars['String']['input']
}

export interface MyRole {
  readonly __typename: 'MyRole'
  readonly name: Scalars['String']['output']
}

export interface NotificationConfigurationError {
  readonly __typename: 'NotificationConfigurationError'
  readonly _: Maybe<Scalars['Boolean']['output']>
}

export interface NotificationTopicNotFound {
  readonly __typename: 'NotificationTopicNotFound'
  readonly _: Maybe<Scalars['Boolean']['output']>
}

export interface NumberExtents {
  readonly __typename: 'NumberExtents'
  readonly max: Scalars['Float']['output']
  readonly min: Scalars['Float']['output']
}

export interface NumberPackageUserMetaFacet extends IPackageUserMetaFacet {
  readonly __typename: 'NumberPackageUserMetaFacet'
  readonly extents: NumberExtents
  readonly path: Scalars['String']['output']
  readonly sortable: Scalars['Boolean']['output']
}

export interface NumberSearchPredicate {
  readonly gte: InputMaybe<Scalars['Float']['input']>
  readonly lte: InputMaybe<Scalars['Float']['input']>
}

export interface ObjectsSearchFilter {
  readonly content: InputMaybe<TextSearchPredicate>
  readonly deleted: InputMaybe<BooleanSearchPredicate>
  readonly ext: InputMaybe<KeywordSearchPredicate>
  readonly key: InputMaybe<KeywordSearchPredicate>
  readonly modified: InputMaybe<DatetimeSearchPredicate>
  readonly size: InputMaybe<NumberSearchPredicate>
}

export type ObjectsSearchMoreResult =
  | InvalidInput
  | ObjectsSearchResultSetPage
  | OperationError

export type ObjectsSearchResult =
  | EmptySearchResultSet
  | InvalidInput
  | ObjectsSearchResultSet
  | OperationError

export interface ObjectsSearchResultSet {
  readonly __typename: 'ObjectsSearchResultSet'
  readonly firstPage: ObjectsSearchResultSetPage
  readonly stats: ObjectsSearchStats
  readonly total: Scalars['Int']['output']
}

export interface ObjectsSearchResultSetfirstPageArgs {
  order: InputMaybe<SearchResultOrder>
  size?: InputMaybe<Scalars['Int']['input']>
}

export interface ObjectsSearchResultSetPage {
  readonly __typename: 'ObjectsSearchResultSetPage'
  readonly cursor: Maybe<Scalars['String']['output']>
  readonly hits: ReadonlyArray<SearchHitObject>
}

export interface ObjectsSearchStats {
  readonly __typename: 'ObjectsSearchStats'
  readonly ext: KeywordExtents
  readonly modified: DatetimeExtents
  readonly size: NumberExtents
}

export interface Ok {
  readonly __typename: 'Ok'
  readonly _: Maybe<Scalars['Boolean']['output']>
}

export interface OperationError {
  readonly __typename: 'OperationError'
  readonly context: Maybe<Scalars['JsonRecord']['output']>
  readonly message: Scalars['String']['output']
  readonly name: Scalars['String']['output']
}

export type OperationResult = InvalidInput | Ok | OperationError

export interface Package {
  readonly __typename: 'Package'
  readonly accessCounts: Maybe<AccessCounts>
  readonly bucket: Scalars['String']['output']
  readonly modified: Scalars['Datetime']['output']
  readonly name: Scalars['String']['output']
  readonly revision: Maybe<PackageRevision>
  readonly revisions: PackageRevisionList
}

export interface PackageaccessCountsArgs {
  window?: InputMaybe<Scalars['Int']['input']>
}

export interface PackagerevisionArgs {
  hashOrTag?: InputMaybe<Scalars['String']['input']>
}

export interface PackageConstructEntry {
  readonly hash: InputMaybe<PackageEntryHash>
  readonly logicalKey: Scalars['String']['input']
  readonly meta: InputMaybe<Scalars['JsonRecord']['input']>
  readonly physicalKey: Scalars['String']['input']
  readonly size: InputMaybe<Scalars['Float']['input']>
}

export type PackageConstructResult = InvalidInput | OperationError | PackagePushSuccess

export interface PackageConstructSource {
  readonly entries: ReadonlyArray<PackageConstructEntry>
}

export interface PackageDir {
  readonly __typename: 'PackageDir'
  readonly children: ReadonlyArray<PackageEntry>
  readonly metadata: Maybe<Scalars['JsonRecord']['output']>
  readonly path: Scalars['String']['output']
  readonly size: Scalars['Float']['output']
}

export type PackageEntry = PackageDir | PackageFile

export interface PackageEntryHash {
  readonly type: Scalars['String']['input']
  readonly value: Scalars['String']['input']
}

export interface PackageFile {
  readonly __typename: 'PackageFile'
  readonly metadata: Maybe<Scalars['JsonRecord']['output']>
  readonly path: Scalars['String']['output']
  readonly physicalKey: Scalars['String']['output']
  readonly size: Scalars['Float']['output']
}

export interface PackageList {
  readonly __typename: 'PackageList'
  readonly page: ReadonlyArray<Package>
  readonly total: Scalars['Int']['output']
}

export interface PackageListpageArgs {
  number?: InputMaybe<Scalars['Int']['input']>
  order?: InputMaybe<PackageListOrder>
  perPage?: InputMaybe<Scalars['Int']['input']>
}

export enum PackageListOrder {
  MODIFIED = 'MODIFIED',
  NAME = 'NAME',
}

export type PackagePromoteResult = InvalidInput | OperationError | PackagePushSuccess

export interface PackagePromoteSource {
  readonly bucket: Scalars['String']['input']
  readonly hash: Scalars['String']['input']
  readonly name: Scalars['String']['input']
}

export interface PackagePushParams {
  readonly bucket: Scalars['String']['input']
  readonly message: InputMaybe<Scalars['String']['input']>
  readonly name: Scalars['String']['input']
  readonly userMeta: InputMaybe<Scalars['JsonRecord']['input']>
  readonly workflow: InputMaybe<Scalars['String']['input']>
}

export interface PackagePushSuccess {
  readonly __typename: 'PackagePushSuccess'
  readonly package: Package
  readonly revision: PackageRevision
}

export interface PackageRevision {
  readonly __typename: 'PackageRevision'
  readonly accessCounts: Maybe<AccessCounts>
  readonly contentsFlatMap: Maybe<Scalars['PackageContentsFlatMap']['output']>
  readonly dir: Maybe<PackageDir>
  readonly file: Maybe<PackageFile>
  readonly hash: Scalars['String']['output']
  readonly message: Maybe<Scalars['String']['output']>
  readonly metadata: Scalars['JsonRecord']['output']
  readonly modified: Scalars['Datetime']['output']
  readonly totalBytes: Maybe<Scalars['Float']['output']>
  readonly totalEntries: Maybe<Scalars['Int']['output']>
  readonly userMeta: Maybe<Scalars['JsonRecord']['output']>
  readonly workflow: Maybe<PackageWorkflow>
}

export interface PackageRevisionaccessCountsArgs {
  window?: InputMaybe<Scalars['Int']['input']>
}

export interface PackageRevisioncontentsFlatMapArgs {
  max?: InputMaybe<Scalars['Int']['input']>
}

export interface PackageRevisiondirArgs {
  path: Scalars['String']['input']
}

export interface PackageRevisionfileArgs {
  path: Scalars['String']['input']
}

export type PackageRevisionDeleteResult = OperationError | PackageRevisionDeleteSuccess

export interface PackageRevisionDeleteSuccess {
  readonly __typename: 'PackageRevisionDeleteSuccess'
  readonly _: Maybe<Scalars['Boolean']['output']>
}

export interface PackageRevisionList {
  readonly __typename: 'PackageRevisionList'
  readonly page: ReadonlyArray<PackageRevision>
  readonly total: Scalars['Int']['output']
}

export interface PackageRevisionListpageArgs {
  number?: InputMaybe<Scalars['Int']['input']>
  perPage?: InputMaybe<Scalars['Int']['input']>
}

export type PackageUserMetaFacet =
  | BooleanPackageUserMetaFacet
  | DatetimePackageUserMetaFacet
  | KeywordPackageUserMetaFacet
  | NumberPackageUserMetaFacet
  | TextPackageUserMetaFacet

export enum PackageUserMetaFacetType {
  BOOLEAN = 'BOOLEAN',
  DATETIME = 'DATETIME',
  KEYWORD = 'KEYWORD',
  NUMBER = 'NUMBER',
  TEXT = 'TEXT',
}

export interface PackageUserMetaPredicate {
  readonly boolean: InputMaybe<BooleanSearchPredicate>
  readonly datetime: InputMaybe<DatetimeSearchPredicate>
  readonly keyword: InputMaybe<KeywordSearchPredicate>
  readonly number: InputMaybe<NumberSearchPredicate>
  readonly path: Scalars['String']['input']
  readonly text: InputMaybe<TextSearchPredicate>
}

export interface PackageWorkflow {
  readonly __typename: 'PackageWorkflow'
  readonly config: Scalars['String']['output']
  readonly id: Maybe<Scalars['String']['output']>
}

export interface PackagerAdminMutations {
  readonly __typename: 'PackagerAdminMutations'
  readonly toggleEventRule: PackagerEventRuleToggleResult
}

export interface PackagerAdminMutationstoggleEventRuleArgs {
  enabled: Scalars['Boolean']['input']
  name: Scalars['String']['input']
}

export interface PackagerAdminQueries {
  readonly __typename: 'PackagerAdminQueries'
  readonly eventRule: Maybe<PackagerEventRule>
  readonly eventRules: ReadonlyArray<PackagerEventRule>
}

export interface PackagerAdminQuerieseventRuleArgs {
  name: Scalars['String']['input']
}

export interface PackagerEventRule {
  readonly __typename: 'PackagerEventRule'
  readonly enabled: Scalars['Boolean']['output']
  readonly name: Scalars['String']['output']
}

export type PackagerEventRuleToggleResult =
  | InvalidInput
  | OperationError
  | PackagerEventRule

export type PackagesFirstPageResult =
  | InvalidInput
  | OperationError
  | PackagesSearchResultSetPage

export interface PackagesSearchFilter {
  readonly comment: InputMaybe<TextSearchPredicate>
  readonly entries: InputMaybe<NumberSearchPredicate>
  readonly hash: InputMaybe<KeywordSearchPredicate>
  readonly modified: InputMaybe<DatetimeSearchPredicate>
  readonly name: InputMaybe<KeywordSearchPredicate>
  readonly size: InputMaybe<NumberSearchPredicate>
  readonly workflow: InputMaybe<KeywordSearchPredicate>
}

export type PackagesSearchMoreResult =
  | InvalidInput
  | OperationError
  | PackagesSearchResultSetPage

export type PackagesSearchResult =
  | EmptySearchResultSet
  | InvalidInput
  | OperationError
  | PackagesSearchResultSet

export interface PackagesSearchResultSet {
  readonly __typename: 'PackagesSearchResultSet'
  readonly filteredUserMetaFacets: ReadonlyArray<PackageUserMetaFacet>
  readonly firstPage: PackagesFirstPageResult
  readonly stats: PackagesSearchStats
  readonly total: Scalars['Int']['output']
}

export interface PackagesSearchResultSetfilteredUserMetaFacetsArgs {
  path: Scalars['String']['input']
  type: InputMaybe<PackageUserMetaFacetType>
}

export interface PackagesSearchResultSetfirstPageArgs {
  ordering: InputMaybe<Scalars['PackageOrdering']['input']>
  size?: InputMaybe<Scalars['Int']['input']>
}

export interface PackagesSearchResultSetPage {
  readonly __typename: 'PackagesSearchResultSetPage'
  readonly cursor: Maybe<Scalars['String']['output']>
  readonly hits: ReadonlyArray<SearchHitPackage>
}

export interface PackagesSearchStats {
  readonly __typename: 'PackagesSearchStats'
  readonly entries: NumberExtents
  readonly modified: DatetimeExtents
  readonly size: NumberExtents
  readonly userMeta: ReadonlyArray<PackageUserMetaFacet>
  readonly userMetaTruncated: Scalars['Boolean']['output']
  readonly workflow: KeywordExtents
}

export interface PermissionInput {
  readonly bucket: Scalars['String']['input']
  readonly level: BucketPermissionLevel
}

export interface Policy {
  readonly __typename: 'Policy'
  readonly arn: Scalars['String']['output']
  readonly id: Scalars['ID']['output']
  readonly managed: Scalars['Boolean']['output']
  readonly permissions: ReadonlyArray<PolicyBucketPermission>
  readonly roles: ReadonlyArray<ManagedRole>
  readonly title: Scalars['String']['output']
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
  readonly admin: AdminQueries
  readonly bucket: Maybe<Bucket>
  readonly bucketAccessCounts: Maybe<BucketAccessCounts>
  readonly bucketConfig: Maybe<BucketConfig>
  readonly bucketConfigs: ReadonlyArray<BucketConfig>
  readonly buckets: ReadonlyArray<Bucket>
  readonly config: Config
  /**
   * One product, or null. Null is an ordinary answer: ids are synthesized from the
   * binding and are not stable across renames.
   */
  readonly dataProduct: Maybe<DataProduct>
  /** Configured external catalogs. Admin-only: endpoints are infrastructure. */
  readonly dataProductConnections: ReadonlyArray<DataProductConnection>
  /**
   * Requests recorded against a product. Always answerable, because the record is
   * Quilt's — an empty list is a real answer, not a failure to reach the platform.
   */
  readonly dataProductRequests: ReadonlyArray<DataProductRequest>
  /**
   * Every product the caller can see, readable or not. Discovery and readability
   * are different questions, and filtering unreadable products out here would hide
   * the case a request affordance exists for.
   */
  readonly dataProducts: ReadonlyArray<DataProduct>
  readonly defaultRole: Maybe<Role>
  readonly me: Maybe<Me>
  readonly objectAccessCounts: Maybe<AccessCounts>
  readonly package: Maybe<Package>
  readonly packages: Maybe<PackageList>
  readonly policies: ReadonlyArray<Policy>
  readonly policy: Maybe<Policy>
  readonly potentialCollaborators: ReadonlyArray<Collaborator>
  readonly role: Maybe<Role>
  readonly roles: ReadonlyArray<Role>
  readonly searchMoreObjects: ObjectsSearchMoreResult
  readonly searchMorePackages: PackagesSearchMoreResult
  readonly searchObjects: ObjectsSearchResult
  readonly searchPackages: PackagesSearchResult
  readonly status: StatusResult
  readonly subscription: SubscriptionState
}

export interface QuerybucketArgs {
  name: Scalars['String']['input']
}

export interface QuerybucketAccessCountsArgs {
  bucket: Scalars['String']['input']
  window: Scalars['Int']['input']
}

export interface QuerybucketConfigArgs {
  name: Scalars['String']['input']
}

export interface QuerydataProductArgs {
  id: Scalars['ID']['input']
}

export interface QuerydataProductRequestsArgs {
  dataProductId: Scalars['ID']['input']
}

export interface QueryobjectAccessCountsArgs {
  bucket: Scalars['String']['input']
  key: Scalars['String']['input']
  window: Scalars['Int']['input']
}

export interface QuerypackageArgs {
  bucket: Scalars['String']['input']
  name: Scalars['String']['input']
}

export interface QuerypackagesArgs {
  bucket: Scalars['String']['input']
  filter: InputMaybe<Scalars['String']['input']>
}

export interface QuerypolicyArgs {
  id: Scalars['ID']['input']
}

export interface QueryroleArgs {
  id: Scalars['ID']['input']
}

export interface QuerysearchMoreObjectsArgs {
  after: Scalars['String']['input']
  size?: InputMaybe<Scalars['Int']['input']>
}

export interface QuerysearchMorePackagesArgs {
  after: Scalars['String']['input']
  size?: InputMaybe<Scalars['Int']['input']>
}

export interface QuerysearchObjectsArgs {
  buckets: InputMaybe<ReadonlyArray<Scalars['String']['input']>>
  filter: InputMaybe<ObjectsSearchFilter>
  searchString: InputMaybe<Scalars['String']['input']>
}

export interface QuerysearchPackagesArgs {
  buckets: InputMaybe<ReadonlyArray<Scalars['String']['input']>>
  filter: InputMaybe<PackagesSearchFilter>
  latestOnly?: Scalars['Boolean']['input']
  searchString: InputMaybe<Scalars['String']['input']>
  userMetaFilters: InputMaybe<ReadonlyArray<PackageUserMetaPredicate>>
}

export type RestoreObjectResult = InvalidInput | OperationError | RestoreObjectSuccess

export interface RestoreObjectSuccess {
  readonly __typename: 'RestoreObjectSuccess'
  readonly alreadyRestored: Scalars['Boolean']['output']
}

export type Role = ManagedRole | UnmanagedRole

export interface RoleAssigned {
  readonly __typename: 'RoleAssigned'
  readonly _: Maybe<Scalars['Boolean']['output']>
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
  | RoleNameUsedBySsoConfig

export interface RoleDeleteSuccess {
  readonly __typename: 'RoleDeleteSuccess'
  readonly _: Maybe<Scalars['Boolean']['output']>
}

export interface RoleDoesNotExist {
  readonly __typename: 'RoleDoesNotExist'
  readonly _: Maybe<Scalars['Boolean']['output']>
}

export interface RoleHasTooManyPoliciesToAttach {
  readonly __typename: 'RoleHasTooManyPoliciesToAttach'
  readonly _: Maybe<Scalars['Boolean']['output']>
}

export interface RoleIsManaged {
  readonly __typename: 'RoleIsManaged'
  readonly _: Maybe<Scalars['Boolean']['output']>
}

export interface RoleIsUnmanaged {
  readonly __typename: 'RoleIsUnmanaged'
  readonly _: Maybe<Scalars['Boolean']['output']>
}

export interface RoleNameExists {
  readonly __typename: 'RoleNameExists'
  readonly _: Maybe<Scalars['Boolean']['output']>
}

export interface RoleNameInvalid {
  readonly __typename: 'RoleNameInvalid'
  readonly _: Maybe<Scalars['Boolean']['output']>
}

export interface RoleNameReserved {
  readonly __typename: 'RoleNameReserved'
  readonly _: Maybe<Scalars['Boolean']['output']>
}

export interface RoleNameUsedBySsoConfig {
  readonly __typename: 'RoleNameUsedBySsoConfig'
  readonly _: Maybe<Scalars['Boolean']['output']>
}

export type RoleSetDefaultResult =
  | RoleDoesNotExist
  | RoleSetDefaultSuccess
  | SsoConfigConflict

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
  | RoleNameUsedBySsoConfig
  | RoleUpdateSuccess

export interface RoleUpdateSuccess {
  readonly __typename: 'RoleUpdateSuccess'
  readonly role: Role
}

export interface SearchHitObject {
  readonly __typename: 'SearchHitObject'
  readonly bucket: Scalars['String']['output']
  readonly deleted: Scalars['Boolean']['output']
  readonly id: Scalars['ID']['output']
  readonly indexedContent: Maybe<Scalars['String']['output']>
  readonly key: Scalars['String']['output']
  readonly modified: Scalars['Datetime']['output']
  readonly score: Scalars['Float']['output']
  readonly size: Scalars['Float']['output']
  readonly version: Scalars['String']['output']
}

export interface SearchHitPackage {
  readonly __typename: 'SearchHitPackage'
  readonly bucket: Scalars['String']['output']
  readonly comment: Maybe<Scalars['String']['output']>
  readonly hash: Scalars['String']['output']
  readonly id: Scalars['ID']['output']
  readonly matchLocations: SearchHitPackageMatchLocations
  readonly matchingEntries: ReadonlyArray<SearchHitPackageMatchingEntry>
  readonly meta: Maybe<Scalars['String']['output']>
  readonly modified: Scalars['Datetime']['output']
  readonly name: Scalars['String']['output']
  readonly pointer: Scalars['String']['output']
  readonly score: Scalars['Float']['output']
  readonly size: Scalars['Float']['output']
  readonly totalEntriesCount: Scalars['Int']['output']
  readonly workflow: Maybe<Scalars['JsonRecord']['output']>
}

export interface SearchHitPackageEntryMatchLocations {
  readonly __typename: 'SearchHitPackageEntryMatchLocations'
  readonly contents: Scalars['Boolean']['output']
  readonly logicalKey: Scalars['Boolean']['output']
  readonly meta: Scalars['Boolean']['output']
  readonly physicalKey: Scalars['Boolean']['output']
}

export interface SearchHitPackageMatchLocations {
  readonly __typename: 'SearchHitPackageMatchLocations'
  readonly comment: Scalars['Boolean']['output']
  readonly meta: Scalars['Boolean']['output']
  readonly name: Scalars['Boolean']['output']
  readonly workflow: Scalars['Boolean']['output']
}

export interface SearchHitPackageMatchingEntry {
  readonly __typename: 'SearchHitPackageMatchingEntry'
  readonly logicalKey: Scalars['String']['output']
  readonly matchLocations: SearchHitPackageEntryMatchLocations
  readonly meta: Maybe<Scalars['String']['output']>
  readonly physicalKey: Scalars['String']['output']
  readonly size: Scalars['Float']['output']
}

export enum SearchResultOrder {
  BEST_MATCH = 'BEST_MATCH',
  LEX_ASC = 'LEX_ASC',
  LEX_DESC = 'LEX_DESC',
  NEWEST = 'NEWEST',
  OLDEST = 'OLDEST',
}

export type SetSsoConfigResult = InvalidInput | OperationError | SsoConfig

export interface SnowflakeListingBinding {
  readonly __typename: 'SnowflakeListingBinding'
  readonly listingId: Scalars['String']['output']
}

export interface SnsInvalid {
  readonly __typename: 'SnsInvalid'
  readonly _: Maybe<Scalars['Boolean']['output']>
}

export interface SsoConfig {
  readonly __typename: 'SsoConfig'
  readonly text: Scalars['String']['output']
  readonly timestamp: Scalars['Datetime']['output']
  readonly uploader: User
}

export interface SsoConfigConflict {
  readonly __typename: 'SsoConfigConflict'
  readonly _: Maybe<Scalars['Boolean']['output']>
}

export interface Status {
  readonly __typename: 'Status'
  readonly canaries: ReadonlyArray<Canary>
  readonly latestStats: TestStats
  readonly reports: StatusReportList
  readonly reportsBucket: Scalars['String']['output']
  readonly stats: TestStatsTimeSeries
}

export interface StatusreportsArgs {
  filter: InputMaybe<StatusReportListFilter>
}

export interface StatusstatsArgs {
  window?: InputMaybe<Scalars['Int']['input']>
}

export interface StatusReport {
  readonly __typename: 'StatusReport'
  readonly renderedReportLocation: Scalars['S3ObjectLocation']['output']
  readonly timestamp: Scalars['Datetime']['output']
}

export interface StatusReportList {
  readonly __typename: 'StatusReportList'
  readonly page: ReadonlyArray<StatusReport>
  readonly total: Scalars['Int']['output']
}

export interface StatusReportListpageArgs {
  number?: Scalars['Int']['input']
  order?: StatusReportListOrder
  perPage?: Scalars['Int']['input']
}

export interface StatusReportListFilter {
  readonly timestampFrom: InputMaybe<Scalars['Datetime']['input']>
  readonly timestampTo: InputMaybe<Scalars['Datetime']['input']>
}

export enum StatusReportListOrder {
  NEW_FIRST = 'NEW_FIRST',
  OLD_FIRST = 'OLD_FIRST',
}

export type StatusResult = Status | Unavailable

export interface SubscriptionInvalid {
  readonly __typename: 'SubscriptionInvalid'
  readonly _: Maybe<Scalars['Boolean']['output']>
}

export interface SubscriptionState {
  readonly __typename: 'SubscriptionState'
  readonly active: Scalars['Boolean']['output']
  readonly timestamp: Scalars['Datetime']['output']
}

export type SwitchRoleResult = InvalidInput | Me | OperationError

export interface TabulatorOpenQueryResult {
  readonly __typename: 'TabulatorOpenQueryResult'
  readonly tabulatorOpenQuery: Scalars['Boolean']['output']
}

export interface TabulatorTable {
  readonly __typename: 'TabulatorTable'
  readonly config: Scalars['String']['output']
  readonly name: Scalars['String']['output']
}

export interface TestStats {
  readonly __typename: 'TestStats'
  readonly failed: Scalars['Int']['output']
  readonly passed: Scalars['Int']['output']
  readonly running: Scalars['Int']['output']
}

export interface TestStatsTimeSeries {
  readonly __typename: 'TestStatsTimeSeries'
  readonly datetimes: ReadonlyArray<Scalars['Datetime']['output']>
  readonly failed: ReadonlyArray<Scalars['Int']['output']>
  readonly passed: ReadonlyArray<Scalars['Int']['output']>
}

export interface TextPackageUserMetaFacet extends IPackageUserMetaFacet {
  readonly __typename: 'TextPackageUserMetaFacet'
  readonly path: Scalars['String']['output']
  readonly sortable: Scalars['Boolean']['output']
}

export interface TextSearchPredicate {
  readonly queryString: Scalars['String']['input']
}

export interface Unavailable {
  readonly __typename: 'Unavailable'
  readonly _: Maybe<Scalars['Boolean']['output']>
}

export interface UnitySchemaBinding {
  readonly __typename: 'UnitySchemaBinding'
  readonly catalog: Scalars['String']['output']
  readonly metastore: Scalars['String']['output']
  readonly schema: Scalars['String']['output']
}

export interface UnityShareBinding {
  readonly __typename: 'UnityShareBinding'
  readonly metastore: Scalars['String']['output']
  readonly shareName: Scalars['String']['output']
}

export interface UnmanagedPolicyInput {
  readonly arn: Scalars['String']['input']
  readonly roles: ReadonlyArray<Scalars['ID']['input']>
  readonly title: Scalars['String']['input']
}

export interface UnmanagedRole {
  readonly __typename: 'UnmanagedRole'
  readonly arn: Scalars['String']['output']
  readonly id: Scalars['ID']['output']
  readonly name: Scalars['String']['output']
}

export interface UnmanagedRoleInput {
  readonly arn: Scalars['String']['input']
  readonly name: Scalars['String']['input']
}

export interface User {
  readonly __typename: 'User'
  readonly dateJoined: Scalars['Datetime']['output']
  readonly email: Scalars['String']['output']
  readonly extraRoles: ReadonlyArray<Role>
  readonly isActive: Scalars['Boolean']['output']
  readonly isAdmin: Scalars['Boolean']['output']
  readonly isAdminAssignmentDisabled: Scalars['Boolean']['output']
  readonly isRoleAssignmentDisabled: Scalars['Boolean']['output']
  readonly isService: Scalars['Boolean']['output']
  readonly isSsoOnly: Scalars['Boolean']['output']
  readonly lastLogin: Scalars['Datetime']['output']
  readonly name: Scalars['String']['output']
  readonly role: Maybe<Role>
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
  name: Scalars['String']['input']
}

export interface UserAdminQueries {
  readonly __typename: 'UserAdminQueries'
  readonly get: Maybe<User>
  readonly list: ReadonlyArray<User>
}

export interface UserAdminQueriesgetArgs {
  name: Scalars['String']['input']
}

export interface UserInput {
  readonly email: Scalars['String']['input']
  readonly extraRoles: InputMaybe<ReadonlyArray<Scalars['String']['input']>>
  readonly name: Scalars['String']['input']
  readonly role: Scalars['String']['input']
}

export type UserResult = InvalidInput | OperationError | User
