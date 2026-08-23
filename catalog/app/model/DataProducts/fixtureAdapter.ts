/**
 * The adapter that stands in until real ones exist.
 *
 * Reads the fixture tables and nothing else. Its value is not the data -- it is
 * that every container now goes through the port, so the day a GraphQL-backed
 * adapter lands, no container changes.
 *
 * Note what it deliberately does **not** implement: `submitRequest`. A fixture
 * cannot file a request with a catalog, and `supportsRequests()` returning false
 * is what keeps the UI's submit affordance honestly disabled. Implementing it
 * here would make the button look live while doing nothing -- worse than no
 * button, and worse still because the lie would be structural rather than
 * visible.
 */

import type { ContentsResult, EntryBodyResult, FetchingAdapter } from './adapter'
import * as fixtures from './fixtures'
import type { AccessRequest } from './requests'
import type { Connection } from './connections'
import type { DataProduct } from './types'

/**
 * `async` bodies with no `await`, on purpose.
 *
 * The port is a network boundary and its callers must treat it as one. Returning
 * plain values here would let a call site accidentally depend on synchronous
 * resolution, which a real adapter would then break.
 *
 * One consequence worth naming rather than discovering later: these resolve on
 * the microtask queue, so a Suspense fallback flashes for approximately no time.
 * The loading path therefore goes visually unexercised with this adapter --
 * exactly the kind of never-rendered branch that rots. Tests cover it explicitly
 * instead of relying on the fixture path to reveal it.
 */
export const fixtureAdapter: FetchingAdapter = {
  async listProducts(): Promise<DataProduct[]> {
    return fixtures.ALL_PRODUCTS
  },

  async getProduct(id: string): Promise<DataProduct | null> {
    // `?? null` rather than letting `undefined` through: the port promises
    // `null` for a miss, and a miss is ordinary drift (synthesized ids are not
    // stable across renames), so callers branch on it as data.
    return fixtures.ALL_PRODUCTS.find((p) => p.id === id) ?? null
  },

  async listRequests(productId: string): Promise<AccessRequest[]> {
    return fixtures.ALL_REQUESTS.filter((r) => r.dataProductId === productId)
  },

  async listConnections(): Promise<Connection[]> {
    return fixtures.ALL_CONNECTIONS
  },

  /**
   * Contents of one member.
   *
   * Derives its answer from the member's own declaration rather than from a
   * lookup table of failures, so the fixture cannot drift out of agreement with
   * the product it describes: a member marked `UNAVAILABLE` reports exactly the
   * reason it states.
   *
   * Note the two different misses. A member whose `contentsSource` is `PACKAGE`
   * but that has no fixture entry is a *fixture* bug, so it returns `EMPTY`
   * rather than inventing a permission story -- consistent with `reasonFor`'s
   * fallback, and for the same reason: guessing "denied" accuses somebody.
   */
  async listContents(
    productId: string,
    memberLogicalName: string,
  ): Promise<ContentsResult> {
    const product = fixtures.ALL_PRODUCTS.find((p) => p.id === productId)
    const member = product?.members.find((m) => m.logicalName === memberLogicalName)

    // An unknown product or member is not the same as an empty one, but neither
    // is it a permission answer. NOT_FOUND is the honest reading: the thing we
    // were asked to enumerate is not there.
    if (!member) return { ok: false, reason: 'NOT_FOUND' }

    if (member.contentsSource === 'UNAVAILABLE') {
      return { ok: false, reason: member.unavailableReason ?? 'EMPTY' }
    }

    // A member the current user cannot read is a catalog-side denial. Reported as
    // NOT_A_MEMBER rather than REGISTRY_UNREADABLE because `readable` is what the
    // *catalog* told us; a storage-layer refusal is a different signal that no
    // fixture can produce.
    if (!member.readable) return { ok: false, reason: 'NOT_A_MEMBER' }

    const entries = fixtures.PACKAGE_CONTENTS[`${productId}::${memberLogicalName}`]
    return { ok: true, entries: entries ?? [] }
  },

  /**
   * One entry's bytes.
   *
   * Reuses `listContents` rather than re-deriving the member state, so the two
   * cannot disagree: an entry in a member that cannot be listed is never
   * fetchable, and it reports the same reason.
   *
   * Note the per-entry denial is checked *after* the member resolves. That
   * ordering is the real one -- the broker authorizes the package, then checks
   * membership per object -- and it is what lets a listing be fully visible while
   * one file in it is refused.
   */
  async fetchEntry(
    productId: string,
    memberLogicalName: string,
    logicalKey: string,
  ): Promise<EntryBodyResult> {
    const listing = await this.listContents(productId, memberLogicalName)
    if (!listing.ok) return { ok: false, reason: listing.reason }

    const entry = listing.entries.find((e) => e.logicalKey === logicalKey)
    if (!entry) return { ok: false, reason: 'NOT_FOUND' }

    // The per-object refusal. NOT_A_MEMBER because the broker's answer is a
    // membership verdict, not a storage-layer one.
    if (entry.readable === false) return { ok: false, reason: 'NOT_A_MEMBER' }

    const text = fixtures.ENTRY_TEXT[logicalKey]
    // No body is not a failure. A .tiff or .parquet has bytes that simply are not
    // text, and saying so lets the file view render identity-without-preview
    // rather than an error or an empty pane.
    if (text === undefined) {
      return {
        ok: true,
        body: { kind: 'opaque', mediaHint: logicalKey.split('.').pop() },
      }
    }
    return { ok: true, body: { kind: 'text', text } }
  },
}
