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

import type { Capabilities, DataProduct, Member } from './types'
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

export const ALL_PRODUCTS: DataProduct[] = [
  DATAZONE_PRODUCT,
  UNITY_PRODUCT,
  SNOWFLAKE_PRODUCT,
  DISCOVERY_ONLY_PRODUCT,
]

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

export const ALL_REQUESTS: AccessRequest[] = [
  UNITY_SUBMITTED_REQUEST,
  DATAZONE_PENDING_REQUEST,
  DATAZONE_REVOKED_RETAINED_REQUEST,
]

/** Requests filed against one product. */
export function requestsFor(product: DataProduct): AccessRequest[] {
  return ALL_REQUESTS.filter((r) => r.dataProductId === product.id)
}
