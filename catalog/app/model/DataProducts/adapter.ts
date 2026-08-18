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

import type { DataProduct } from './types'
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
