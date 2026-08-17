/**
 * Per-platform capability declarations.
 *
 * Each entry says what that catalog can actually answer. Every value is
 * traceable to first-hand documentation research -- see
 * `wb/dp-ui-slice-1/research/dp-read-shape-contract.md` for the clause and
 * `research/databricks-unity.md` for the Unity detail.
 *
 * Adapters expose these; the UI consults them. The render mode gates the UI,
 * never the adapter (clause 7.1) -- an adapter must fetch full fidelity
 * regardless of what the current mode will display, because data not fetched
 * cannot be recovered by flipping a switch later.
 */

import type { Capabilities, PlatformKind } from './types'

/**
 * AWS DataZone.
 *
 * The only target platform with a native product entity, and the only one with
 * an enumerable request/approval object -- but it has *no* certification
 * concept and emits *no* product-level events.
 */
const DATAZONE: Capabilities = {
  // CreateDataProduct / GetDataProduct is a real addressable entity carrying
  // name, description, glossaryTerms, items[], and up to 10 metadata forms.
  nativeProductEntity: true,

  // ListSubscriptionRequests defaults to PENDING when status is unspecified, so
  // a pending-requests inbox is the zero-config default. Three addressable
  // layers exist: request -> subscription -> grant.
  enumerableRequests: true,
  initiableRequests: true,

  // Access is a subscription enumeration, not an inherited-grant model. There
  // is no direct/inherited distinction to report.
  effectivePermissions: false,

  // 36 EventBridge detail-types exist, including `Asset Added To Inventory` and
  // `Asset Added To Catalog` (which map onto the dual-graph model). But there
  // is NO data-product event -- product-level change must be inferred from
  // member-asset events or polled.
  changeEvents: true,

  // Verified absent from AssetListing, AssetListingItem, DataProductListing,
  // DataProductListingItem, GetDataProduct, CreateAsset, and the 200+ operation
  // list. Only achievable as a customer-defined metadata form.
  curationStatus: false,

  // Tabular schema exists but only inside an opaque JSON `forms` string
  // requiring a per-form-type parser; the S3 asset type carries only
  // `bucketArn` and no columns at all. Not a uniform field read.
  memberSchema: false,

  effectiveAccessForNamedUser: false,
}

/**
 * Databricks Unity Catalog.
 *
 * No product entity at all -- Databricks documents that absence as intentional
 * design, with product lifecycle living "outside the platform through
 * documented contracts". Best-in-class effective permissions; no webhooks.
 */
const UNITY: Capabilities = {
  // No data product object exists. A product is synthesized from a schema plus
  // tags, or from a share. Verified twice: absent from the securable-object
  // enumeration, and affirmatively stated in Databricks' own guidance.
  nativeProductEntity: false,

  // A native request flow exists (browse without read -> request -> routed to
  // email/Slack/Teams/webhook with an approval assist). But only the
  // *destinations* API is documented; whether pending requests can be listed is
  // unresolved, so the honest declaration is initiate-only.
  enumerableRequests: false,
  initiableRequests: true,

  // GET /api/2.1/unity-catalog/effective-permissions/{type}/{name} resolves
  // inheritance AND the USE CATALOG + USE SCHEMA + SELECT conjunction
  // server-side, with no compute required. The strongest such surface of the
  // three platforms.
  effectivePermissions: true,

  // No webhooks. Only a polled audit table, which community sources suggest
  // does not even capture DDL.
  changeEvents: false,

  // system.certification_status = certified | deprecated, a real system tag.
  // The one genuine curation primitive across all three platforms.
  curationStatus: true,

  // Tabular members expose columns via TableInfo / information_schema.COLUMNS.
  // FILESET (volume) members do not -- that is correct representation, not a
  // gap, and is handled per-member rather than by this flag.
  memberSchema: true,

  effectiveAccessForNamedUser: false,
}

/**
 * Snowflake (Horizon).
 *
 * Closest analog to a product is an organizational listing -- a distribution
 * wrapper over exactly one share. Weakest access-observability story of the
 * three.
 */
const SNOWFLAKE: Capabilities = {
  // A listing is a distribution wrapper over one share, not a product with a
  // curated heterogeneous member list.
  nativeProductEntity: false,

  // Request flows exist for Marketplace/organizational listings, not for
  // ordinary tables and schemas.
  enumerableRequests: false,
  initiableRequests: false,

  // Effective access requires traversing a role closure (roles granted to
  // roles, plus USAGE chains, plus PUBLIC). Computable in principle via
  // recursive CTEs over ACCOUNT_USAGE, but only against a snapshot up to 120
  // minutes stale, and GRANTS_TO_ROLES omits grants to database roles from
  // databases created from shares. Not a trustworthy direct/inherited signal.
  effectivePermissions: false,

  changeEvents: false,
  curationStatus: false,

  // External/directory tables and stages expose structure unevenly.
  memberSchema: false,

  effectiveAccessForNamedUser: false,
}

export const CAPABILITIES: Record<PlatformKind, Capabilities> = {
  datazone: DATAZONE,
  'unity-schema': UNITY,
  'unity-share': UNITY,
  'snowflake-listing': SNOWFLAKE,
}

/**
 * The intersection: capabilities every platform supports.
 *
 * This is what `intersection` render mode may rely on. Note that every
 * discretionary capability is false here -- the intersection is genuinely thin,
 * which is the honest starting point and the reason capability-aware mode
 * exists at all.
 */
export const INTERSECTION: Capabilities = {
  nativeProductEntity: false,
  enumerableRequests: false,
  initiableRequests: false,
  effectivePermissions: false,
  changeEvents: false,
  curationStatus: false,
  memberSchema: false,
  effectiveAccessForNamedUser: false,
}

/**
 * Capabilities the UI should consult, given a render mode.
 *
 * `intersection` deliberately returns the lowest common denominator regardless
 * of platform, so intersection-mode rendering cannot accidentally depend on a
 * single platform's extras. `capability-aware` returns the real ones.
 *
 * Note what this function does *not* do: it does not filter or reshape product
 * data. Adapters have already fetched everything. This only decides what gets
 * displayed (clause 7.1).
 */
export function forMode(
  platform: PlatformKind,
  mode: 'intersection' | 'capability-aware',
) {
  return mode === 'intersection' ? INTERSECTION : CAPABILITIES[platform]
}

/**
 * Guard against re-creating vendor lock-in inside a nominally portable model.
 *
 * Clause 7.2: at least two platforms must support a capability before the UI
 * branches on it, with a documented exception where a single-platform
 * capability is genuinely load-bearing.
 *
 * `curationStatus` is the current documented exception -- Unity-only, but it is
 * the sole curation primitive available anywhere, so it earns its branch.
 */
export const SINGLE_PLATFORM_EXCEPTIONS: ReadonlySet<keyof Capabilities> = new Set([
  'curationStatus',
])

export function supportingPlatformCount(capability: keyof Capabilities): number {
  const seen = new Set<Capabilities>()
  let n = 0
  for (const caps of Object.values(CAPABILITIES)) {
    // unity-schema and unity-share share one object; count Unity once.
    if (seen.has(caps)) continue
    seen.add(caps)
    if (caps[capability]) n += 1
  }
  return n
}

/** Whether the UI is permitted to branch on `capability` per clause 7.2. */
export function mayBranchOn(capability: keyof Capabilities): boolean {
  return (
    supportingPlatformCount(capability) >= 2 || SINGLE_PLATFORM_EXCEPTIONS.has(capability)
  )
}
