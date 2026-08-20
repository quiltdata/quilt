/**
 * The adapter port: the one boundary between the UI and an external catalog.
 *
 * Containers must not reach for `fixtures` directly. They ask this port, and
 * something behind it decides where the answer comes from -- today a fixture
 * table, later a GraphQL resolver over DataZone / Unity / Horizon. Swapping that
 * must not touch a single container.
 *
 * **Async on purpose, even though the fixture implementation is not.** A real
 * adapter is a network call: it fails, it takes time, it can return partial
 * results. Modelling the port as synchronous would let every call site assume
 * data is always present, and every one of them would need reopening the day an
 * adapter lands. The awkwardness of Promises here is the cost of not lying about
 * what this becomes.
 *
 * What the port deliberately does **not** expose:
 *
 * - **No `whoHasAccess(user, product)`.** Undecidable, not merely unimplemented.
 *   See `Capabilities.effectiveAccessForNamedUser`, typed as literal `false`.
 * - **No write path for grants.** Quilt does not grant access to an
 *   externally-owned product; the catalog does. `submitRequest` records an
 *   intention, and the catalog decides.
 * - **No `refresh()` or subscription.** No platform emits product-level change
 *   events (contract §6.3), so a hook promising live updates would be fiction.
 *   Callers re-ask and get a new `fetchedAt`.
 */

import type { DataProduct, UnavailableReason } from './types'
import type { ContentEntry } from './contents'
import type { AccessRequest } from './requests'

/**
 * What an adapter can be asked.
 *
 * One interface rather than one-per-platform: the platform difference lives in
 * `Capabilities` (data), not in the shape of the port (configuration). An
 * implementation covering only one platform returns only its products.
 */
export interface DataProductAdapter {
  /**
   * Every product this user can see -- which includes products they cannot read
   * into. Discovery and readability are different questions, and filtering
   * unreadable products out here would hide the case a request affordance
   * exists for.
   */
  listProducts(): Promise<DataProduct[]>

  /**
   * One product, or `null` when it is not there.
   *
   * `null` is an expected answer rather than an error: product ids are
   * synthesized from the platform binding and are **not stable across renames**
   * (a Unity schema rename silently changes the id and emits no event), so a
   * miss is ordinary drift.
   */
  getProduct(id: string): Promise<DataProduct | null>

  /**
   * Access requests recorded against a product.
   *
   * Always answerable, because the record is Quilt's. Only DataZone can
   * enumerate platform-native requests, so an adapter reconciles what it can and
   * leaves `platformRecord: null` where it cannot -- which is a steady state on
   * Unity, not a pending sync.
   */
  listRequests(productId: string): Promise<AccessRequest[]>
}

/**
 * An adapter that can also file a request.
 *
 * Separate from `DataProductAdapter` because initiating is a real capability
 * split: `initiableRequests` is true on DataZone and Unity, false on Snowflake.
 * An adapter for a platform with no request flow should not have to implement a
 * method that throws -- absence of the method is the honest encoding, and
 * `supportsRequests()` lets the UI ask without a cast.
 */
export interface RequestingAdapter extends DataProductAdapter {
  /**
   * Record an intention to grant. Returns the stored request.
   *
   * Never returns an approval: no adapter can approve on the catalog's behalf.
   * The returned request is `SUBMITTED` at best.
   */
  submitRequest(input: {
    dataProductId: string
    beneficiary: AccessRequest['beneficiary']
    reason: string
  }): Promise<AccessRequest>
}

export function supportsRequests(
  adapter: DataProductAdapter,
): adapter is RequestingAdapter {
  return typeof (adapter as RequestingAdapter).submitRequest === 'function'
}

/**
 * An adapter that can enumerate a member's contents.
 *
 * **A separate call on purpose, not a field on `Member`.** In the one working
 * implementation, listing a product does not yield its contents: the locator
 * lives on the asset rather than the listing, so resolving it costs an extra
 * read that is *authorized separately* -- a caller can list products and still
 * be refused the handle (`research/raja-poc-reverse-engineered.md` §1.1, §2).
 * Folding contents into `listProducts` would model that cost away and make the
 * discoverable-but-unresolvable state unrepresentable.
 *
 * Split from `DataProductAdapter` for the same reason as `RequestingAdapter`: an
 * adapter for a platform that cannot enumerate contents should not implement a
 * method that throws. Whether a *given member* can be enumerated is a different
 * question, carried by `Member.contentsSource`.
 */
export interface BrowsingAdapter extends DataProductAdapter {
  /**
   * Entries in one member, as a flat list of logical keys.
   *
   * Flat rather than pre-grouped because that is what a manifest is; grouping
   * into directory levels is the UI's job (`model/DataProducts/contents`).
   *
   * Returns `UnavailableReason` rather than throwing when contents cannot be
   * listed. Four of those reasons are ordinary states -- an empty package, a
   * product whose target was never published, and two different permission
   * layers -- and an exception would flatten them into one failure that the UI
   * could only render as an error.
   */
  listContents(productId: string, memberLogicalName: string): Promise<ContentsResult>
}

export type ContentsResult =
  | { ok: true; entries: ContentEntry[] }
  | { ok: false; reason: UnavailableReason }

export function supportsBrowsing(
  adapter: DataProductAdapter,
): adapter is BrowsingAdapter {
  return typeof (adapter as BrowsingAdapter).listContents === 'function'
}
