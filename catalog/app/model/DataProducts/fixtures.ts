/**
 * Data Product fixtures, one per platform binding.
 *
 * These stand in for adapters that do not exist yet: no pipeline publishes
 * magic tables, and no byte broker is wired. The point is to build UX against a
 * shape that is *congruent with what the platforms actually produce* -- so
 * these fixtures are deliberately pessimistic, and each awkward field carries
 * the doc-verified reason it is that way.
 *
 * Deliberately unfaithful in exactly one respect: `locator.token` is a made-up
 * string. That is safe because the UI never dereferences a locator -- it is
 * opaque and passed onward (clause 1.4). Everything else mirrors what its
 * platform can really return.
 *
 * Three variants exist rather than one because intersection-mode rendering
 * alone would let capability-aware mode rot untested (clause 7.3).
 */

import type { Capabilities, DataProduct, Member, PackageHandle } from './types'
import type { Connection } from './connections'
import type { ContentEntry } from './contents'
import type { AccessRequest } from './requests'
import { CAPABILITIES } from './capabilities'

const token = (s: string) => ({ token: s })

/** Fixed so snapshots and "last checked" rendering stay deterministic. */
const FETCHED_AT = new Date('2026-08-17T12:00:00.000Z')

/**
 * DataZone: a product wrapper over two heterogeneous members.
 *
 * Notable, and all verified:
 * - `curationStatus` is null because DataZone has no such concept -- not
 *   because this product is uncertified. Read it through the capability flag.
 * - `owningEntity` is a PROJECT with `derived: false`. There is no per-product
 *   owner API (`ListEntityOwners` is DOMAIN_UNIT-only); a human name would have
 *   to be derived from project memberships, hence PROJECT rather than a person.
 * - The S3 member has `schema: null` and no `sizeBytes`. DataZone's S3 asset
 *   type carries only `bucketArn`; granularity is bucket/prefix, never
 *   per-object. A fixture showing per-file sizes would teach the UI a shape
 *   DataZone cannot deliver.
 * - The tabular member *does* have columns, but reaching them requires parsing
 *   an opaque JSON `forms` string -- which is why `memberSchema` is false for
 *   DataZone even though columns appear here.
 * - Grants are PROJECT-principal with `origin: 'UNKNOWN'`: subscriptions are
 *   enumerations, not an inherited-grant model.
 */
export const DATAZONE_PRODUCT: DataProduct = {
  id: 'datazone:dzd_4xample/lst_9kq2v',
  name: 'Clinical Cohort 2024',
  description: 'Curated patient cohort with linked assay outputs. Quarterly refresh.',
  labels: ['clinical', 'cohort', 'phi-adjacent'],
  curationStatus: null,
  owningEntity: { kind: 'PROJECT', label: 'Clinical Data Platform', derived: false },
  members: [
    {
      logicalName: 'cohort_manifest',
      kind: 'TABLE',
      schema: [
        { name: 'subject_id', type: 'string', description: 'Pseudonymised subject key' },
        { name: 'enrolled_on', type: 'date' },
        { name: 'site_code', type: 'string' },
        { name: 'arm', type: 'string', description: 'Treatment arm' },
      ],
      locator: token('dz:asset/4h8x2p:cohort_manifest'),
      readable: true,
      // Glue table: DataZone enumerates it and Lake Formation governs it, so
      // row/column rules may be filtering what we display.
      contentsSource: 'CATALOG',
    },
    {
      logicalName: 'assay_outputs',
      kind: 'FILESET',
      schema: null,
      locator: token('dz:asset/7m1k9q:assay_outputs'),
      readable: false,
      // The S3 asset form carries only {"bucketArn": ...} -- no file list, no
      // sizes. Browsing into it means Quilt listing S3 off that ARN, which
      // reaches around the catalog: its governance does not cover what we show.
      // Here `readable: false` means we cannot list it at all yet.
      contentsSource: 'DIRECT_S3',
    },
  ],
  grants: [
    {
      principal: 'Clinical Data Platform',
      principalType: 'PROJECT',
      privilege: 'READ',
      nativePrivilege: 'SUBSCRIPTION:APPROVED',
      origin: 'UNKNOWN',
    },
    {
      principal: 'Biostatistics',
      principalType: 'PROJECT',
      privilege: 'READ',
      nativePrivilege: 'SUBSCRIPTION:APPROVED',
      origin: 'UNKNOWN',
    },
  ],
  // An approved DataZone subscription may be row/column-filtered via
  // assetScopes[].filterIds, so a policy can be present without us being able
  // to characterise it.
  policyFlags: { rowLevel: 'PRESENT', columnMask: 'NOT_VISIBLE' },
  binding: {
    kind: 'datazone',
    domainId: 'dzd_4xample',
    listingId: 'lst_9kq2v',
    entityId: 'ast_2bv7',
  },
  fetchedAt: FETCHED_AT,
}

/**
 * Unity Catalog: a synthesized product -- a schema plus tags.
 *
 * Notable, and all verified:
 * - `id` is composed from metastore/catalog/schema and is *not stable across
 *   renames*. Nothing emits an event when it changes.
 * - `curationStatus` is populated. Unity is the only platform with a real
 *   curation primitive (`system.certification_status`).
 * - Grants carry `origin` because the effective-permissions endpoint reports
 *   it, and `nativePrivilege` shows the conjunction Unity actually requires:
 *   `USE CATALOG` and `USE SCHEMA` are separate grants from `SELECT`, and
 *   normalizing them all to READ would erase why a user can or cannot read.
 * - The FILESET member is a volume: `schema: null`, `READ VOLUME` rather than
 *   `SELECT`, and no row policy is even possible on it -- volumes are not
 *   tables.
 * - `BROWSE` appears as a grant to `account users`: discovery without data
 *   access, which is the state the UI must render without implying readability.
 */
export const UNITY_PRODUCT: DataProduct = {
  id: 'uc:aws-prod-metastore/quilt_demo/acme_cohort_2024',
  name: 'acme_cohort_2024',
  description: 'Acme Cohort 2024 - curated clinical package metadata.',
  labels: ['data_product=acme_cohort_2024', 'domain=clinical'],
  curationStatus: 'certified',
  owningEntity: { kind: 'PRINCIPAL', label: 'data-platform-team', derived: false },
  members: [
    {
      logicalName: 'package_entries',
      kind: 'TABLE',
      schema: [
        { name: 'package_name', type: 'string' },
        { name: 'package_top_hash', type: 'string', description: 'Immutable revision' },
        { name: 'logical_key', type: 'string' },
        { name: 'size_bytes', type: 'bigint' },
        { name: 'physical_uri', type: 'string', description: 'Opaque to the UI' },
      ],
      locator: token('uc:quilt_demo.acme_cohort_2024.package_entries'),
      readable: true,
      // Unity table: columns via TableInfo, and row filters / column masks can
      // be attached, so the catalog both enumerates and governs it.
      contentsSource: 'CATALOG',
    },
    {
      logicalName: 'raw_files',
      kind: 'FILESET',
      schema: null,
      locator: token('uc:/Volumes/quilt_demo/acme_cohort_2024/raw_files'),
      sizeBytes: 4_812_390_400,
      readable: true,
      // A volume is path-based and cannot be a table, so no row/column rule can
      // reach it. Unity can list the path (READ VOLUME, /api/2.0/fs/*), but the
      // contents are ungoverned by row-level policy either way.
      contentsSource: 'CATALOG',
    },
  ],
  grants: [
    {
      principal: 'account users',
      principalType: 'GROUP',
      privilege: 'BROWSE',
      nativePrivilege: 'BROWSE',
      origin: 'DIRECT',
    },
    {
      principal: 'quilt-consumers',
      principalType: 'GROUP',
      privilege: 'READ',
      nativePrivilege: 'USE CATALOG',
      origin: 'INHERITED',
    },
    {
      principal: 'quilt-consumers',
      principalType: 'GROUP',
      privilege: 'READ',
      nativePrivilege: 'USE SCHEMA',
      origin: 'DIRECT',
    },
    {
      principal: 'quilt-consumers',
      principalType: 'GROUP',
      privilege: 'READ',
      nativePrivilege: 'SELECT',
      origin: 'DIRECT',
    },
    {
      principal: 'data-platform-team',
      principalType: 'GROUP',
      privilege: 'MANAGE',
      nativePrivilege: 'ALL PRIVILEGES',
      origin: 'DIRECT',
    },
  ],
  policyFlags: { rowLevel: 'PRESENT', columnMask: 'PRESENT' },
  binding: {
    kind: 'unity-schema',
    metastore: 'aws-prod-metastore',
    catalog: 'quilt_demo',
    schema: 'acme_cohort_2024',
  },
  fetchedAt: FETCHED_AT,
}

/**
 * Snowflake: an organizational listing over one share.
 *
 * Notable, and all verified:
 * - Grants are ROLE-principal with `origin: 'UNKNOWN'`. Effective access needs
 *   a role-closure traversal against a snapshot up to 120 minutes stale, with a
 *   documented blind spot for share-derived database roles. Claiming
 *   DIRECT/INHERITED here would be a fabricated confidence.
 * - `policyFlags.rowLevel` is `NOT_VISIBLE`, not false. `POLICY_REFERENCES`
 *   filters by the caller's own privileges, so a role without APPLY/OWNERSHIP
 *   sees nothing. This fixture exists partly to force the UI to render that
 *   third state honestly.
 * - `owningEntity` is a role, not a person -- Snowflake ownership is
 *   role-based.
 */
export const SNOWFLAKE_PRODUCT: DataProduct = {
  id: 'snowflake:GZT1a9xQ2',
  name: 'Trial Outcomes (Shared)',
  description: null,
  labels: ['trials'],
  curationStatus: null,
  owningEntity: { kind: 'PRINCIPAL', label: 'DATA_PRODUCT_OWNER', derived: false },
  members: [
    {
      logicalName: 'TRIAL_OUTCOMES',
      kind: 'VIEW',
      schema: null,
      locator: token('sf:SHARED_DB.PUBLIC.TRIAL_OUTCOMES'),
      readable: true,
      // A share-derived view: Snowflake enumerates it, and a row access policy
      // may be attached that POLICY_REFERENCES will not disclose to us (see
      // policyFlags.rowLevel: 'NOT_VISIBLE' below). Governed, but opaquely so.
      contentsSource: 'CATALOG',
    },
  ],
  grants: [
    {
      principal: 'ANALYST_RL',
      principalType: 'ROLE',
      privilege: 'READ',
      nativePrivilege: 'SELECT',
      origin: 'UNKNOWN',
    },
    {
      principal: 'PUBLIC',
      principalType: 'ROLE',
      privilege: 'BROWSE',
      nativePrivilege: 'USAGE',
      origin: 'UNKNOWN',
    },
  ],
  policyFlags: { rowLevel: 'NOT_VISIBLE', columnMask: 'NOT_VISIBLE' },
  binding: { kind: 'snowflake-listing', listingId: 'GZT1a9xQ2' },
  fetchedAt: FETCHED_AT,
}

/**
 * A discovery-only product: visible, zero readable members.
 *
 * Unity's `BROWSE` grants exactly this -- see the product, its description and
 * tags, read nothing. Not an error state and not an empty product; it is the
 * state that makes a request-access affordance meaningful (clause 3.2, 5.2),
 * and the one most likely to be mishandled as "no data".
 */
export const DISCOVERY_ONLY_PRODUCT: DataProduct = {
  id: 'uc:aws-prod-metastore/quilt_demo/restricted_cohort',
  name: 'restricted_cohort',
  description: 'Restricted cohort. Request access to view contents.',
  labels: ['data_product=restricted_cohort', 'domain=clinical', 'sensitivity=high'],
  curationStatus: null,
  owningEntity: { kind: 'PRINCIPAL', label: 'clinical-governance', derived: false },
  members: [],
  grants: [
    {
      principal: 'account users',
      principalType: 'GROUP',
      privilege: 'BROWSE',
      nativePrivilege: 'BROWSE',
      origin: 'DIRECT',
    },
  ],
  policyFlags: { rowLevel: 'UNKNOWN', columnMask: 'UNKNOWN' },
  binding: {
    kind: 'unity-schema',
    metastore: 'aws-prod-metastore',
    catalog: 'quilt_demo',
    schema: 'restricted_cohort',
  },
  fetchedAt: FETCHED_AT,
}

/**
 * Unity via Delta Sharing: the fourth binding kind, and the only one where the
 * product is consumed rather than owned.
 *
 * Exists because `unity-share` had no fixture at all while being a real
 * `PlatformBinding` case that maps to the same UNITY capabilities as
 * `unity-schema`. Three branches only this fixture reaches:
 *
 * - `curationStatus: null` *with* `caps.curationStatus === true`. Unity can
 *   express curation, this share has none set. That is the "Not set" reading --
 *   genuinely different from DataZone, where the field is absent because the
 *   concept does not exist. Nothing else exercises the difference.
 * - A `RECIPIENT` principal, whose approval widens to everyone using the share.
 * - An `UNAVAILABLE` member, the third `ContentsSource` state.
 */
export const UNITY_SHARE_PRODUCT: DataProduct = {
  id: 'uc:aws-prod-metastore/share/acme_trials_outbound',
  name: 'acme_trials_outbound',
  description: 'Trial results shared out to the Acme analytics recipient.',
  labels: ['domain=clinical', 'sharing=outbound'],
  // Unity *can* carry certification; this share has none. Renders "Not set",
  // not absent -- see the class comment.
  curationStatus: null,
  owningEntity: { kind: 'PRINCIPAL', label: 'data-platform-team', derived: false },
  members: [
    {
      logicalName: 'trial_results',
      kind: 'TABLE',
      schema: [
        { name: 'trial_id', type: 'string' },
        { name: 'endpoint', type: 'string', description: 'Primary endpoint measured' },
        { name: 'value', type: 'double' },
      ],
      locator: token('uc:share/acme_trials_outbound#trial_results'),
      readable: true,
      contentsSource: 'CATALOG',
    },
    {
      // A share entry that no longer resolves on the provider side. Shares
      // reference objects by name, so a dropped or renamed upstream table leaves
      // an entry that cannot be listed -- distinct from "not readable by you",
      // which is a permission answer rather than a missing object.
      logicalName: 'trial_sites',
      kind: 'TABLE',
      schema: null,
      locator: token('uc:share/acme_trials_outbound#trial_sites'),
      readable: false,
      contentsSource: 'UNAVAILABLE',
      // NOT_FOUND, not a permission answer: shares reference objects by name, so
      // a dropped or renamed upstream table leaves an entry pointing at nothing.
      // The distinction matters here more than most places -- `readable: false`
      // on this member is the catalog reporting it cannot resolve the target,
      // and telling the reader to request access would send them to an admin who
      // finds nothing to grant.
      unavailableReason: 'NOT_FOUND',
    },
  ],
  grants: [
    {
      // `GRANT SELECT ON SHARE ... TO RECIPIENT ...` -- the recipient is the
      // principal, and it is an external identity rather than a workspace group.
      principal: 'acme_analytics',
      principalType: 'RECIPIENT',
      privilege: 'READ',
      nativePrivilege: 'SELECT',
      origin: 'DIRECT',
    },
    {
      principal: 'data-platform-team',
      principalType: 'GROUP',
      privilege: 'MANAGE',
      nativePrivilege: 'ALL PRIVILEGES',
      origin: 'DIRECT',
    },
  ],
  // Not claimed either way: what a recipient sees through a share is mediated by
  // the provider's own rules, and the share surface does not report whether a
  // row filter or column mask sits behind it. UNKNOWN rather than a guess.
  policyFlags: { rowLevel: 'UNKNOWN', columnMask: 'UNKNOWN' },
  binding: {
    kind: 'unity-share',
    metastore: 'aws-prod-metastore',
    shareName: 'acme_trials_outbound',
  },
  fetchedAt: FETCHED_AT,
}

/**
 * DataZone wrapping a **Quilt package** -- modeled on a real deployment.
 *
 * Every awkward detail here was read out of AWS's `raja-poc` staging domain
 * rather than invented; see `research/raja-poc-reverse-engineered.md`. It is the
 * only fixture whose shape is corroborated by something running.
 *
 * What it exercises that nothing else does:
 * - `contentsSource: 'PACKAGE'` -- contents come from a pinned manifest, so the
 *   listing carries logical keys and per-entry sizes and is reproducible. The
 *   other file-ish source (`DIRECT_S3`) has neither.
 * - A `packageHandle` on the binding *and* on the member. Real: the locator is
 *   the asset's `externalIdentifier`, a fully-pinned Quilt+ URI.
 *
 * The names mirror the real domain (`alpha/home` under project `raja-owner`) so
 * anyone comparing this fixture to the live deployment sees the same shape.
 */
export const PACKAGE_PRODUCT: DataProduct = {
  id: 'datazone:dzd-61b4n7ubllnqlj/46g5jnuhfnucyv',
  name: 'alpha/home',
  // The real asset's description is generated: "RAJA package asset for
  // alpha/home". Kept close to that rather than written as marketing copy,
  // because a generated description is what the UI will actually receive.
  description: 'RAJA package asset for alpha/home. JWT-scoped read via the broker.',
  labels: ['raja', 'package-backed'],
  curationStatus: null,
  owningEntity: { kind: 'PROJECT', label: 'raja-owner', derived: false },
  members: [
    {
      // One member per package. The real implementation is one listing per
      // package, with entries enumerated on demand by walking the manifest --
      // so a member here is the package, not a file in it.
      logicalName: 'alpha/home',
      // FILESET rather than TABLE: package entries are files. No columns exist
      // to expose, and `schema: null` is correct representation, not a gap.
      kind: 'FILESET',
      schema: null,
      locator: token(
        'quilt+s3://raja-poc-registry-712023778557-us-east-1#package=alpha/home@bee98d06',
      ),
      readable: true,
      contentsSource: 'PACKAGE',
      // Sizes come from the manifest, so a total is knowable without touching
      // S3 -- unlike DIRECT_S3, where the catalog carries only a bucket ARN.
      sizeBytes: 369,
      packageHandle: {
        registry: 'raja-poc-registry-712023778557-us-east-1',
        name: 'alpha/home',
        topHash: 'bee98d061f67228f36ee807e42bea4165575c02495c996119b3587c7f8e6ed84',
      },
    },
  ],
  grants: [
    {
      principal: 'raja-owner',
      principalType: 'PROJECT',
      privilege: 'MANAGE',
      nativePrivilege: 'OWNING_PROJECT',
      origin: 'UNKNOWN',
    },
    {
      // A real approved subscription in the live domain, whose subscribed
      // principal is a *project* rather than a person -- which is why
      // PrincipalType has a PROJECT arm at all.
      principal: 'raja-guests',
      principalType: 'PROJECT',
      privilege: 'READ',
      nativePrivilege: 'SUBSCRIPTION:APPROVED',
      origin: 'UNKNOWN',
    },
  ],
  // Nothing observed says otherwise, and the broker's grant is package-wide with
  // per-object membership checks rather than a row filter. NOT_VISIBLE would
  // imply we looked and were refused; UNKNOWN is the honest state.
  policyFlags: { rowLevel: 'UNKNOWN', columnMask: 'UNKNOWN' },
  binding: {
    kind: 'datazone',
    domainId: 'dzd-61b4n7ubllnqlj',
    listingId: '46g5jnuhfnucyv',
    entityId: 'brga0b06ujf3tz',
    packageHandle: {
      registry: 'raja-poc-registry-712023778557-us-east-1',
      name: 'alpha/home',
      topHash: 'bee98d061f67228f36ee807e42bea4165575c02495c996119b3587c7f8e6ed84',
    },
  },
  fetchedAt: FETCHED_AT,
}

/**
 * A published product pointing at a package that does not resolve.
 *
 * **Not hypothetical.** Four of the seven products published in `raja-poc` are
 * in this state: `scale/1k`, `scale/10k`, `scale/100k` and `scale/1m` are all
 * discoverable and subscribable, and `Package.browse` on each fails `NoSuchKey`
 * against the registry that deployment is configured with (research §5).
 *
 * Exists so `NOT_FOUND` is rendered by something rather than being a branch
 * nobody has seen. Note the shape it forces: the product is complete and legible
 * -- name, description, owner, grants -- and only its contents are missing. A UI
 * that treated unresolvable contents as a broken product would hide information
 * the reader can still use.
 */
export const DANGLING_PACKAGE_PRODUCT: DataProduct = {
  id: 'datazone:dzd-61b4n7ubllnqlj/5i2yhfmdd9nbqf',
  name: 'scale/1k',
  description: 'RAJA package asset for scale/1k. Scale-test fixture.',
  labels: ['raja', 'scale-test'],
  curationStatus: null,
  owningEntity: { kind: 'PROJECT', label: 'raja-owner', derived: false },
  members: [
    {
      logicalName: 'scale/1k',
      kind: 'FILESET',
      schema: null,
      locator: token(
        'quilt+s3://raja-poc-registry-712023778557-us-east-1#package=scale/1k@0000000',
      ),
      // `readable: true` is deliberate and is the point of this fixture. The
      // catalog authorized us; the package is simply not where it says. Setting
      // this false would conflate a publishing fault with a permission denial --
      // exactly the collapse the four reasons exist to prevent.
      readable: true,
      contentsSource: 'UNAVAILABLE',
      unavailableReason: 'NOT_FOUND',
      packageHandle: {
        registry: 'raja-poc-registry-712023778557-us-east-1',
        name: 'scale/1k',
        topHash: '0000000000000000000000000000000000000000000000000000000000000000',
      },
    },
  ],
  grants: [
    {
      principal: 'raja-owner',
      principalType: 'PROJECT',
      privilege: 'MANAGE',
      nativePrivilege: 'OWNING_PROJECT',
      origin: 'UNKNOWN',
    },
  ],
  policyFlags: { rowLevel: 'UNKNOWN', columnMask: 'UNKNOWN' },
  binding: {
    kind: 'datazone',
    domainId: 'dzd-61b4n7ubllnqlj',
    listingId: '5i2yhfmdd9nbqf',
    packageHandle: {
      registry: 'raja-poc-registry-712023778557-us-east-1',
      name: 'scale/1k',
      topHash: '0000000000000000000000000000000000000000000000000000000000000000',
    },
  },
  fetchedAt: FETCHED_AT,
}

export const ALL_PRODUCTS: DataProduct[] = [
  DATAZONE_PRODUCT,
  PACKAGE_PRODUCT,
  DANGLING_PACKAGE_PRODUCT,
  UNITY_PRODUCT,
  UNITY_SHARE_PRODUCT,
  SNOWFLAKE_PRODUCT,
  DISCOVERY_ONLY_PRODUCT,
]

/**
 * Contents per member, keyed `productId::memberLogicalName`.
 *
 * Separate from the products because that is how it really arrives: the locator
 * is not in a listing, so enumerating contents is a second call authorized
 * separately (research §1.1, §2). Hanging entries off `Member` would model that
 * cost away.
 *
 * Mirrors the real `alpha/home` manifest -- three files, those exact sizes --
 * plus nesting the real package lacks, because a browser that has only rendered
 * a flat list has never exercised drilling in.
 */
/**
 * Build an entry's pinned USL the way the real implementation does.
 *
 * A helper rather than eight hand-typed URIs, because the point of the field is
 * that every entry's URI shares one registry and one revision -- a copy-paste
 * fixture would let them drift and quietly stop demonstrating that.
 * Deliberately mirrors the shape `raja/quilt_uri.py` produces:
 * `quilt+s3://{registry}#package={name}@{hash}&path={key}`.
 */
const usl = (handle: PackageHandle, logicalKey: string) =>
  `quilt+s3://${handle.registry}#package=${handle.name}@${handle.topHash}&path=${logicalKey}`

const ALPHA_HOME: PackageHandle = {
  registry: 'raja-poc-registry-712023778557-us-east-1',
  name: 'alpha/home',
  topHash: 'bee98d061f67228f36ee807e42bea4165575c02495c996119b3587c7f8e6ed84',
}

const alphaEntry = (
  logicalKey: string,
  rest: Omit<ContentEntry, 'logicalKey' | 'usl'> = {},
): ContentEntry => ({ logicalKey, usl: usl(ALPHA_HOME, logicalKey), ...rest })

export const PACKAGE_CONTENTS: Record<string, ContentEntry[]> = {
  [`datazone:dzd-61b4n7ubllnqlj/46g5jnuhfnucyv::alpha/home`]: [
    // The three real entries, with their real sizes.
    alphaEntry('README.md', { sizeBytes: 147, readable: true }),
    alphaEntry('data.csv', { sizeBytes: 115, readable: true }),
    alphaEntry('results.json', { sizeBytes: 107, readable: true }),
    // Nesting, so drill-down is exercised. Numeric suffixes out of order on
    // purpose: plate_2 must sort before plate_10, which bytewise ordering gets
    // wrong.
    alphaEntry('raw/plate_2/A01.tiff', { sizeBytes: 2_048, readable: true }),
    alphaEntry('raw/plate_10/A01.tiff', { sizeBytes: 4_096, readable: true }),
    alphaEntry('raw/plate_10/A02.tiff', { sizeBytes: 4_096, readable: true }),
    // One unsized entry, which forces its folder's total to be withheld rather
    // than shown as a partial sum.
    alphaEntry('raw/plate_10/A03.tiff', { readable: true }),
    // Present in the manifest but refused by the broker. Real: membership is
    // checked per object, so a listing can be fully visible while one object in
    // it is denied (research §3.1).
    alphaEntry('derived/restricted.parquet', { sizeBytes: 8_192, readable: false }),
  ],
}

/**
 * Text bodies for the entries a preview can actually render.
 *
 * Only three, and that is the honest set: a preview needs bytes, the UI is not
 * in the byte path, and no broker is wired. So these stand in for what a broker
 * would return for the small text-ish files -- and the `.tiff` and `.parquet`
 * entries deliberately have **no** body, because an image or columnar preview
 * cannot be faked from a string. A file view must render those as
 * identity-without-preview rather than inventing something.
 *
 * Contents match the real package's file names; the bodies are plausible rather
 * than copied, since the real objects are 147/115/107 bytes of test data.
 */
export const ENTRY_TEXT: Record<string, string> = {
  'README.md': [
    '# alpha/home',
    '',
    'Test package published to the RAJA proof-of-concept registry.',
    '',
    '- `data.csv` — subject-level readouts',
    '- `results.json` — summary statistics',
  ].join('\n'),
  'data.csv': [
    'subject_id,arm,value',
    'S-0001,treatment,4.21',
    'S-0002,control,3.86',
    'S-0003,treatment,4.55',
  ].join('\n'),
  'results.json': JSON.stringify(
    { n: 3, arms: ['treatment', 'control'], mean: 4.206, generated: '2026-04-26' },
    null,
    2,
  ),
}

/** Capabilities that go with a fixture, so UI wiring stays consistent. */
export function capabilitiesFor(product: DataProduct): Capabilities {
  return CAPABILITIES[product.binding.kind]
}

/** Members the current user can actually read. */
export function readableMembers(product: DataProduct): Member[] {
  return product.members.filter((m) => m.readable)
}

/**
 * Access requests, one per state the UI has to render honestly.
 *
 * Chosen to cover the cases that are easy to get wrong rather than the happy
 * path: a request the catalog cannot confirm, an approval whose blast radius
 * exceeds the requester, and a revocation that did not actually revoke.
 */

/**
 * Unity: initiated, and permanently unconfirmable.
 *
 * Unity can start a request but cannot list pending ones
 * (`enumerableRequests: false`), so `platformRecord: null` with `SUBMITTED` is
 * not a transient stage here -- it is the steady state. A UI that treats
 * "no platform record yet" as "still syncing" would show a spinner forever.
 */
export const UNITY_SUBMITTED_REQUEST: AccessRequest = {
  id: 'dpr_01hq8x',
  dataProductId: DISCOVERY_ONLY_PRODUCT.id,
  requestedBy: 'simon@quiltdata.io',
  beneficiary: { type: 'USER', label: 'simon@quiltdata.io' },
  reason: 'Cohort reconciliation for the Q3 assay comparison.',
  createdAt: new Date('2026-08-15T09:20:00.000Z'),
  status: 'SUBMITTED',
  platformRecord: null,
  retainedPermissions: null,
}

/**
 * DataZone: pending, and the beneficiary is a project.
 *
 * The blast-radius case. A DataZone subscription is held by a project, so
 * approving this grants every member of Clinical Data Platform -- not the one
 * person who asked. `grantsBeyondRequester` is true here.
 */
export const DATAZONE_PENDING_REQUEST: AccessRequest = {
  id: 'dpr_01hq9m',
  dataProductId: DATAZONE_PRODUCT.id,
  requestedBy: 'rita@quiltdata.io',
  beneficiary: { type: 'PROJECT', label: 'Clinical Data Platform' },
  reason: 'Linking assay outputs to enrolment records for the 2024 cohort.',
  createdAt: new Date('2026-08-16T14:05:00.000Z'),
  status: 'PENDING',
  platformRecord: {
    id: 'subreq_7fk2p',
    reconciledAt: FETCHED_AT,
  },
  retainedPermissions: null,
}

/**
 * DataZone: revoked with permissions retained -- the §5.4 trap, made concrete.
 *
 * DataZone stopped managing this subscription, but the underlying Lake
 * Formation permissions are still live. The status field alone says `REVOKED`;
 * the access is not gone. `accessMayPersistAfterRevoke` is true and `isSettled`
 * is false, which is the whole point of keeping those two separate.
 */
export const DATAZONE_REVOKED_RETAINED_REQUEST: AccessRequest = {
  id: 'dpr_01hq4c',
  dataProductId: DATAZONE_PRODUCT.id,
  requestedBy: 'former-contractor@example.com',
  beneficiary: { type: 'PROJECT', label: 'Assay Ops' },
  reason: 'Temporary access for the migration audit.',
  createdAt: new Date('2026-06-02T11:00:00.000Z'),
  status: 'REVOKED',
  platformRecord: {
    id: 'sub_2mq8t',
    reconciledAt: FETCHED_AT,
  },
  retainedPermissions: true,
}

/**
 * A share request whose beneficiary is a recipient.
 *
 * The fourth widening shape. A Delta Sharing recipient is an *external*
 * identity, so approval hands access to whoever holds that recipient's
 * credentials -- not to a person and not to a group inside this workspace. The
 * other fixtures cover USER and PROJECT; without this one the RECIPIENT branch
 * of the blast-radius wording is unreachable, and a reviewer would have to take
 * it on faith.
 *
 * `platformRecord` is null for the same reason as the Unity schema case: Unity
 * cannot enumerate requests, so this is the steady state rather than a stage.
 */
export const UNITY_SHARE_RECIPIENT_REQUEST: AccessRequest = {
  id: 'dpr_01hqb2',
  dataProductId: UNITY_SHARE_PRODUCT.id,
  requestedBy: 'priya@quiltdata.io',
  beneficiary: { type: 'RECIPIENT', label: 'acme_analytics' },
  reason: 'Acme needs the site-level breakdown for their Q3 readout.',
  createdAt: new Date('2026-08-17T08:40:00.000Z'),
  status: 'SUBMITTED',
  platformRecord: null,
  retainedPermissions: null,
}

/**
 * The settled happy path, which nothing else covered.
 *
 * Every other request fixture is unresolved in some way, so `isSettled` was only
 * ever exercised as `true` against a synthesized object in the spec -- never
 * against something the UI actually renders. A reviewer reading the fixtures
 * would reasonably conclude the model has no clean terminal state.
 */
export const UNITY_APPROVED_REQUEST: AccessRequest = {
  id: 'dpr_01hq7a',
  dataProductId: UNITY_PRODUCT.id,
  requestedBy: 'dana@quiltdata.io',
  beneficiary: { type: 'GROUP', label: 'quilt-consumers' },
  reason: 'Joining package metadata against the assay manifest.',
  createdAt: new Date('2026-08-10T13:15:00.000Z'),
  status: 'APPROVED',
  platformRecord: {
    id: 'req_9xk3m',
    reconciledAt: FETCHED_AT,
  },
  retainedPermissions: null,
}

export const ALL_REQUESTS: AccessRequest[] = [
  UNITY_SUBMITTED_REQUEST,
  DATAZONE_PENDING_REQUEST,
  DATAZONE_REVOKED_RETAINED_REQUEST,
  UNITY_SHARE_RECIPIENT_REQUEST,
  UNITY_APPROVED_REQUEST,
]

/** Requests filed against one product. */
export function requestsFor(product: DataProduct): AccessRequest[] {
  return ALL_REQUESTS.filter((r) => r.dataProductId === product.id)
}

/**
 * Connections, one per state an admin actually has to act on.
 *
 * Chosen so the three `ConnectionState`s are all reachable: a working one, one
 * that has never been checked, and one that is failing. A fixture set of three
 * READY connections would leave the two states that need admin attention
 * untested and unrendered.
 */

/** DataZone, working. IAM_ROLE because there is no OAuth path on this platform. */
export const DATAZONE_CONNECTION: Connection = {
  id: 'dpc_01',
  title: 'Clinical DataZone (us-east-1)',
  platform: 'datazone',
  endpoint: 'dzd_4xample',
  authMethod: 'IAM_ROLE',
  secretRef: null, // an assumed role needs no stored secret
  state: 'READY',
  statusMessage: null,
  lastCheckedAt: new Date('2026-08-18T09:30:00.000Z'),
}

/**
 * Databricks, configured but never exercised.
 *
 * The state most likely to be misread. Products from this catalog will not load,
 * and an empty list would look like "this catalog has no products" rather than
 * "nobody has verified this connection" -- which is why `isUsable` refuses to
 * treat UNVERIFIED as working.
 */
export const UNITY_CONNECTION: Connection = {
  id: 'dpc_02',
  title: 'Databricks (acme-prod)',
  platform: 'unity-schema',
  endpoint: 'https://acme-prod.cloud.databricks.com',
  authMethod: 'OAUTH_U2M',
  secretRef:
    'arn:aws:secretsmanager:us-east-1:123456789012:secret:databricks-oauth-Ab3xY9',
  state: 'UNVERIFIED',
  statusMessage: null,
  lastCheckedAt: null,
}

/** Snowflake, failing. The message is what the platform said, not a paraphrase. */
export const SNOWFLAKE_CONNECTION: Connection = {
  id: 'dpc_03',
  title: 'Snowflake (ACME_PROD)',
  platform: 'snowflake-listing',
  endpoint: 'acme-prod.us-east-1.snowflakecomputing.com',
  authMethod: 'OAUTH_M2M',
  secretRef:
    'arn:aws:secretsmanager:us-east-1:123456789012:secret:snowflake-oauth-Kp7mQ2',
  state: 'ERROR',
  statusMessage: 'OAuth token exchange returned 401: invalid_client',
  lastCheckedAt: new Date('2026-08-18T08:15:00.000Z'),
}

export const ALL_CONNECTIONS: Connection[] = [
  DATAZONE_CONNECTION,
  UNITY_CONNECTION,
  SNOWFLAKE_CONNECTION,
]
