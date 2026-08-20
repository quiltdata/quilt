/**
 * Data Products: the read shape.
 *
 * Data Products are owned and defined in *external* enterprise catalogs -- AWS
 * DataZone, Databricks Unity Catalog, Snowflake Horizon -- not in Quilt. Quilt
 * renders them. The catalog owns the product and every access decision.
 *
 * This module is the type-level contract for what we expect to receive. Its
 * shape is deliberately pessimistic: fields are nullable where a platform has
 * no source for them, and capabilities (below) say what a given platform can
 * actually answer. Both properties come from first-hand doc research on all
 * three platforms; the reasoning per field lives in
 * `wb/dp-ui-slice-1/research/dp-read-shape-contract.md`, clause numbers cited
 * inline.
 *
 * Two things this file will not do, because no target platform can support them:
 *
 * - Answer "can user X read object Y". Not unimplemented -- unanswerable. See
 *   `Capabilities.effectiveAccessForNamedUser` and clause 5.3.
 * - Report what rows a given user would see. Row-policy bodies can call
 *   external functions, so visibility depends on systems outside the data
 *   platform. Clause 5.3a.
 */

/**
 * How to address a Quilt package, pinned to an immutable revision.
 *
 * Modeled on what a real deployment does rather than on what we'd design: AWS's
 * `raja-poc` publishes DataZone assets of a custom type whose `externalIdentifier`
 * is exactly this, serialized as a Quilt+ URI
 * (`quilt+s3://{registry}#package={name}@{topHash}`). Verified first-hand against
 * the live staging domain -- see
 * `wb/dp-ui-slice-1/research/raja-poc-reverse-engineered.md` §1.
 *
 * `topHash` is not optional, and that is the point. The broker accepts an
 * *unpinned* reference and silently resolves it to whatever is current, so
 * reproducibility is a property of how the caller addressed the package rather
 * than of the system (§3.2). Making the field mandatory means the UI cannot
 * accidentally render a moving target as a fixed one.
 */
export interface PackageHandle {
  /** Registry bucket. Not derivable from the package name -- it is deployment config. */
  registry: string
  /** `namespace/name`. */
  name: string
  /** Immutable revision. Mandatory: see above. */
  topHash: string
}

/**
 * Which external catalog a product came from, and how to address it there.
 *
 * The `packageHandle` on the DataZone arm is optional because it is a property
 * of the *asset type*, not of DataZone: `raja-poc` defines a custom
 * `QuiltPackage` type carrying a package URI, while a native DataZone S3 asset
 * carries only `{"bucketArn": "..."}` with no package concept at all. Both are
 * DataZone products. Absent means "this DataZone product is not package-backed",
 * not "we failed to read it".
 */
export type PlatformBinding =
  | {
      kind: 'datazone'
      domainId: string
      listingId: string
      entityId?: string
      /**
       * Present when the product is package-backed. Read from the asset's
       * `externalIdentifier`, which is an asset-level field rather than a
       * metadata form -- so it is **not** in a listing response and costs a
       * separate, separately-authorized read (§1.1, §2).
       */
      packageHandle?: PackageHandle
    }
  | { kind: 'unity-schema'; metastore: string; catalog: string; schema: string }
  | { kind: 'unity-share'; metastore: string; shareName: string }
  | { kind: 'snowflake-listing'; listingId: string }

export type PlatformKind = PlatformBinding['kind']

/**
 * What a member *is*. Load-bearing -- see clause 3.4.
 *
 * Tabular and file members are not interchangeable. On Unity a FILESET is a
 * volume: not queryable, no row/column rules possible, different privilege
 * (`READ VOLUME` not `SELECT`), different API family. A UI that assumes tabular
 * will mis-render filesets and mis-state their governance.
 */
export type MemberKind = 'TABLE' | 'VIEW' | 'FILESET'

export interface Column {
  name: string
  /** Platform-native type string. Not normalized -- platforms disagree. */
  type: string
  description?: string
}

/**
 * An opaque handle the UI passes onward to fetch bytes. Never dereferenced
 * here: the UI is not in the byte path (clause 1.4).
 *
 * Opaque by design, so fixtures can carry any stable token.
 */
export interface MemberLocator {
  readonly token: string
}

/**
 * Where a member's *contents* come from, and therefore whose rules apply.
 *
 * Operator decision 2026-08-17: Quilt browses **into** a product -- a reader
 * must see everything it contains (contract §2). That forces this distinction
 * into the model, because the two sources carry different guarantees:
 *
 * - `CATALOG` -- the catalog enumerates the contents and governs them. Row and
 *   column rules apply, and may be silently filtering what we display.
 * - `DIRECT_S3` -- the catalog cannot enumerate them, so Quilt lists S3 itself.
 *   A DataZone S3 asset carries only `{"bucketArn": "..."}` with no file list,
 *   no sizes, and no per-object granularity, so this is the *only* way to show
 *   file contents there. The catalog's governance does **not** cover what we
 *   render (contract §7.1).
 *
 * - `PACKAGE` -- the member is a Quilt package, enumerated from its manifest.
 *   Distinct from `DIRECT_S3` even though both end at S3 objects, because the
 *   manifest is a *pinned* index: it carries logical keys, sizes, and an
 *   immutable revision, so the listing is reproducible rather than a
 *   point-in-time bucket scan. It is also the enforcement authority -- the
 *   broker answers "may this object be read" by checking manifest membership.
 *   Modeled on a real deployment, not speculation: see
 *   `wb/dp-ui-slice-1/research/raja-poc-reverse-engineered.md` §3, §4.
 * - `UNAVAILABLE` -- contents cannot be listed. Pair with `UnavailableReason`,
 *   which distinguishes four causes fixed by four different people.
 *
 * A UI must not flatten these into one undifferentiated list: doing so implies
 * a uniform governance guarantee that does not exist.
 */
export type ContentsSource = 'CATALOG' | 'DIRECT_S3' | 'PACKAGE' | 'UNAVAILABLE'

/**
 * Why a member's contents cannot be listed. Only meaningful when
 * `contentsSource` is `UNAVAILABLE`.
 *
 * Four reasons, not one, because they are **fixed by different people** and a
 * single "no files" message sends users to the wrong one. All four are live in
 * `raja-poc` today -- 4 of its 7 published products are in one of these states
 * (research §5, §5a):
 *
 * - `EMPTY` -- resolvable and genuinely contains nothing. Not a failure.
 * - `NOT_FOUND` -- the locator resolves to nothing in the registry it names.
 *   A publishing bug, or a product pointing at a registry that was never
 *   populated. Nobody can grant their way out of this.
 * - `NOT_A_MEMBER` -- the caller lacks *catalog-side* authorization. Verified as
 *   distinct: the same admin credential got AccessDenied on one DataZone project
 *   and success on another, so this is project membership, not IAM (§2). Fixed by
 *   a catalog/project admin.
 * - `REGISTRY_UNREADABLE` -- the caller is authorized in the catalog but cannot
 *   read the underlying storage; typically a cross-account bucket policy. Fixed
 *   by a storage/cloud admin.
 *
 * The last two are both "you lack access" and are the pair most tempting to
 * merge. Do not: one is a catalog grant, the other a bucket policy, and knowing
 * which determines who to ask.
 */
export type UnavailableReason =
  | 'EMPTY'
  | 'NOT_FOUND'
  | 'NOT_A_MEMBER'
  | 'REGISTRY_UNREADABLE'

export interface Member {
  logicalName: string
  kind: MemberKind
  /**
   * Columns, when the platform exposes them.
   *
   * `null` is a real and common answer, not a gap:
   * - Always `null` for FILESET.
   * - DataZone's S3 asset type carries only `bucketArn` -- no columns at all.
   *   Its granularity is bucket/prefix, never per-object (clause 3.4).
   * - DataZone tabular schema exists but only inside an opaque JSON `forms`
   *   string needing a per-form-type parser.
   */
  schema: Column[] | null
  locator: MemberLocator
  sizeBytes?: number
  /**
   * Whether *the current user* can read this. The only access question that is
   * honestly answerable on every platform (clause 5.1).
   */
  readable: boolean
  /**
   * How this member's contents are reached, and whose governance applies.
   *
   * Required under browse-into, and deliberately not defaulted: an adapter must
   * state it, because guessing wrong means either hiding real contents or
   * implying governance that is not there.
   */
  contentsSource: ContentsSource
  /**
   * Why contents are unlistable. Required when `contentsSource` is
   * `UNAVAILABLE` and meaningless otherwise -- see `UnavailableReason` for why
   * one reason is not enough.
   *
   * Not folded into `contentsSource` as extra variants because the two answer
   * different questions: source is "whose rules govern what you see", reason is
   * "who can fix this". A member can be `PACKAGE`-sourced and still unavailable.
   */
  unavailableReason?: UnavailableReason
  /**
   * The package this member's contents live in, when `contentsSource` is
   * `PACKAGE`.
   *
   * Per-member rather than per-product on purpose: a product may wrap several
   * packages, or mix a package member with catalog-governed tables. Pinned, so a
   * rendered listing names the exact revision it came from.
   */
  packageHandle?: PackageHandle
}

/** Normalized privilege. `native` is mandatory alongside -- see clause 4.1. */
export type Privilege = 'BROWSE' | 'READ_METADATA' | 'READ' | 'WRITE' | 'MANAGE'

export type PrincipalType =
  | 'USER'
  | 'GROUP'
  | 'SERVICE_PRINCIPAL'
  | 'ROLE'
  | 'RECIPIENT'
  /** DataZone: a subscription holder may be a project, not a person (clause 4.4). */
  | 'PROJECT'
  | 'UNKNOWN'

export interface Grant {
  /**
   * Display string as the platform reports it -- *not* a stable id. Unity
   * surfaces email-ish forms and does not sync group renames proactively
   * (clause 4.3). Do not key durable state on this.
   */
  principal: string
  principalType: PrincipalType
  privilege: Privilege
  /**
   * Verbatim platform privilege, e.g. `SELECT`, `READ VOLUME`, `USE CATALOG`.
   *
   * Mandatory, not decorative. Unity has 60+ privileges and needs a
   * *conjunction* (`USE CATALOG` + `USE SCHEMA` + `SELECT`) for one read;
   * normalizing to `READ` discards that. Normalize for display, never for
   * storage (clause 4.1).
   */
  nativePrivilege: string
  /**
   * Direct vs inherited. Populate wherever the platform can say -- Unity's
   * effective-permissions endpoint resolves this server-side. A list that
   * flattens everything to `UNKNOWN` reads as complete while omitting most
   * principals who can actually read, and the flattening cannot be undone
   * later without re-plumbing the adapter (clause 4.2).
   */
  origin: 'DIRECT' | 'INHERITED' | 'UNKNOWN'
}

/**
 * Row/column policy detection is three-state, and that is not fussiness.
 *
 * Snowflake's `POLICY_REFERENCES` filters by the caller's own privileges: a
 * role lacking `APPLY`/`OWNERSHIP` sees *nothing*. So a negative means "no
 * policy visible to us", never "no policy exists" (clause 5.4a). Rendering
 * absence as a guarantee would be a false assurance about data protection.
 */
export type PolicyPresence = 'PRESENT' | 'NOT_VISIBLE' | 'UNKNOWN'

export interface PolicyFlags {
  rowLevel: PolicyPresence
  columnMask: PolicyPresence
}

/**
 * An owning entity -- deliberately not `owner`, and deliberately not a person.
 *
 * Unity has a single owning principal (possibly a group). DataZone has *no*
 * per-product owner: `ListEntityOwners` accepts `DOMAIN_UNIT` only, so
 * ownership is `owningProjectId` + `createdBy`, and a human must be *derived*
 * via project memberships. "Owner" does not map 1:1 across platforms
 * (clause 3.7).
 *
 * A UI showing a person here is doing derivation and should say so.
 */
export interface OwningEntity {
  kind: 'PRINCIPAL' | 'PROJECT'
  /** Display name/id as the platform reports it. */
  label: string
  /** True when a human name was derived rather than read directly. */
  derived: boolean
}

export interface DataProduct {
  /**
   * Synthetic id composed from the binding (clause 2.2).
   *
   * Not stable across renames. On Unity a schema rename silently changes this
   * and emits no event, so do not use it as a durable external reference
   * without also keeping `name` for reconciliation (clause 2.3).
   */
  id: string
  name: string
  /** Null is normal: a container may simply have no comment (clause 3.1). */
  description: string | null
  /**
   * Flattens three different concepts -- DataZone glossary terms, Unity tags,
   * Snowflake tags -- into one list. Fidelity is lost by construction
   * (clause 3.3).
   */
  labels: string[]
  /**
   * Curation signal. **Unity only.**
   *
   * Unity has `system.certification_status` (`certified` | `deprecated`) as a
   * real system tag. DataZone has no native certification concept anywhere in
   * its API surface -- verified absent from every listing structure and the
   * 200+ operation list; there it could only be a customer-defined metadata
   * form parsed from an opaque string. Gate reads on
   * `Capabilities.curationStatus` rather than assuming null means "not
   * certified" (clause 3.6).
   */
  curationStatus: 'certified' | 'deprecated' | null
  owningEntity: OwningEntity | null
  /**
   * May be empty even for a product that exists: a caller with discovery-only
   * access (Unity `BROWSE`) sees the product and no members (clause 3.2, 5.2).
   *
   * Populating this can cost N+1. DataZone's `ListingSummaryItem` carries no
   * name and no type, so member details need one `GetListing` per member.
   */
  members: Member[]
  grants: Grant[]
  policyFlags: PolicyFlags
  binding: PlatformBinding
  /**
   * When we last read this. **Not** a freshness guarantee.
   *
   * No platform emits product-level change events -- not even DataZone, whose
   * 36 EventBridge detail-types include none for data products. Unity has no
   * webhooks at all. So a synthesized product can silently change composition
   * (renamed container, dropped tag, newly matching member) with nothing
   * emitted. Render as "last checked", never as live sync (clause 6.3).
   */
  fetchedAt: Date
}

/**
 * What a platform can actually answer.
 *
 * Declared by each adapter, consulted by the UI. This is the C half of the
 * A-then-C strategy: adapters always fetch full fidelity plus these flags, and
 * the UI decides what to render.
 *
 * Clause 7.1 is the load-bearing rule: **the render mode gates the UI layer,
 * never the adapter layer.** If an adapter normalizes down to the intersection
 * at its boundary, capability data is discarded before the UI sees it, and
 * switching modes later cannot recover what was never fetched.
 */
export interface Capabilities {
  /** Does a native product entity exist, or do we synthesize one? */
  nativeProductEntity: boolean
  /** Can pending access requests be listed? Decides queue vs initiate-only. */
  enumerableRequests: boolean
  /** Can a request be initiated at all? */
  initiableRequests: boolean
  /** Can inherited grants be distinguished from direct ones? */
  effectivePermissions: boolean
  /** Does the platform emit change events? (No platform: product-level.) */
  changeEvents: boolean
  /** Is `curationStatus` readable here? */
  curationStatus: boolean
  /** Is per-member column schema available? */
  memberSchema: boolean
  /**
   * Always `false`, on every platform, permanently.
   *
   * Kept as an explicit flag rather than omitted so that anyone tempted to add
   * a per-user access verdict finds this field and its reasoning first.
   *
   * Unity: nested group membership is not API-enumerable when the nested group
   * was not explicitly provisioned, so any per-person answer is incomplete by
   * construction. DataZone: no such operation exists, and an approved
   * subscription may itself be row/column-filtered. Snowflake: computable only
   * by reimplementing its authorization semantics against a snapshot up to 120
   * minutes stale, with a documented blind spot for share-derived database
   * roles.
   *
   * And the platform-independent reason, which holds even given a perfect
   * zero-latency grant graph: row-policy bodies accept arbitrary boolean SQL
   * *including external functions*, so row visibility can depend on a network
   * call to a system outside the data platform. Unknowable in principle
   * (clause 5.3, 5.3a).
   */
  effectiveAccessForNamedUser: false
}

/**
 * Rendering mode -- one switch, not N booleans.
 *
 * `intersection` renders only what all platforms support, ignoring
 * capabilities. `capability-aware` renders per the adapter's declared
 * capabilities. Two states to test rather than 2^N combinations; per-platform
 * variation stays *data* (Capabilities) rather than configuration (clause 7).
 */
export type RenderMode = 'intersection' | 'capability-aware'
