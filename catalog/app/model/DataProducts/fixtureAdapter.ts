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

import type { DataProductAdapter } from './adapter'
import * as fixtures from './fixtures'
import type { AccessRequest } from './requests'
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
export const fixtureAdapter: DataProductAdapter = {
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
}
