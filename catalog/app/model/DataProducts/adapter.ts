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

/**
 * What a broker returned for one entry.
 *
 * **Text only, and that is a decision rather than a limitation of today's
 * fixtures.** The UI is not in the byte path: it hands a locator plus the user's
 * credential to a broker and gets bytes back. For a small text-ish file that is
 * enough to render, because every text-shaped preview renderer in this codebase
 * accepts a string. For an image, a PDF, or a Parquet file it is not -- those
 * renderers need a URL the browser can fetch, or a Blob.
 *
 * So this type deliberately cannot express "here is an image". A file view given
 * a `.tiff` must render identity-without-preview, which is the honest outcome,
 * rather than being handed something that looks previewable and is not. When a
 * broker can issue a short-lived URL, that becomes a second variant here and the
 * renderers that need one become reachable -- an additive change, and the reason
 * this is a tagged result rather than a bare string.
 */
export type EntryBody =
  | {
      kind: 'text'
      text: string
      /**
       * True when the broker returned a prefix rather than the whole object.
       *
       * Carried so a preview can say so. A truncated file rendered as complete is
       * the kind of quiet misreport that costs a reader real time -- a JSON
       * preview that silently loses its tail looks like malformed data.
       */
      truncated?: boolean
    }
  /**
   * The entry exists and is readable, but its bytes are not renderable as text.
   *
   * Not an error and not a denial: a 4 GB TIFF is a perfectly good object. The
   * `mediaHint` is for explaining *why* there is no preview, never for guessing at
   * one.
   */
  | { kind: 'opaque'; mediaHint?: string }

export type EntryBodyResult =
  | { ok: true; body: EntryBody }
  | { ok: false; reason: UnavailableReason }

/**
 * An adapter that can fetch one entry's bytes.
 *
 * Separate from `BrowsingAdapter` because listing and reading are separately
 * authorized in the real implementation: the broker checks manifest membership
 * *per object*, so a caller can enumerate a package fully and still be refused a
 * single file in it (`research/raja-poc-reverse-engineered.md` §3.1). An adapter
 * that can list but not fetch is a real shape, not a half-built one.
 */
export interface FetchingAdapter extends BrowsingAdapter {
  /**
   * One entry's bytes, or the reason they are unavailable.
   *
   * Keyed by logical key rather than by the entry's `usl`, so a caller does not
   * have to hold the listing to ask -- and so a fixture cannot silently depend on
   * a URI it never validated.
   */
  fetchEntry(
    productId: string,
    memberLogicalName: string,
    logicalKey: string,
  ): Promise<EntryBodyResult>
}

export function supportsFetching(
  adapter: DataProductAdapter,
): adapter is FetchingAdapter {
  return typeof (adapter as FetchingAdapter).fetchEntry === 'function'
}
