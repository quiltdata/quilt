/**
 * The hooks containers use to reach data products.
 *
 * These are the only sanctioned way in. A container that imports `fixtures`
 * directly has bypassed the port, and the day a real adapter lands that
 * container silently keeps reading fixtures -- which is exactly the failure the
 * port exists to prevent.
 *
 * Built on `utils/ResourceCache` rather than a bespoke `useEffect` + `useState`
 * pair, for the same reasons `CatalogSettings` is: the cache dedupes concurrent
 * reads of the same key, survives unmount/remount, and suspends rather than
 * making every call site render a spinner branch by hand. `Buckets` and the DP
 * detail view both ask for the product list; with the cache that is one fetch.
 *
 * All three suspend. They are safe wherever `CatalogSettings.use()` is safe --
 * inside the app's root Suspense boundary, which is everywhere these render.
 */

import * as Cache from 'utils/ResourceCache'

import type { ContentsResult, DataProductAdapter, EntryBodyResult } from './adapter'
import { supportsBrowsing, supportsFetching } from './adapter'
import type { AccessRequest } from './requests'
import type { Connection } from './connections'
import type { DataProduct } from './types'

/**
 * Which adapter the hooks read from.
 *
 * A module-level singleton rather than a React context, deliberately: there is
 * exactly one adapter per deployment, chosen by what the registry can serve, and
 * nothing in the UI ever wants two at once. A context would invite per-subtree
 * overriding -- which sounds flexible and in practice means two screens
 * disagreeing about what exists.
 *
 * Loaded lazily, not statically: this module is imported by the volumes landing
 * (through `useProducts`), which every flag-off customer renders -- and a static
 * import here drags the whole fixture corpus into that chunk. The dynamic import
 * keeps the adapter (and everything behind it) in its own chunk, fetched only
 * when a resource below actually consults it, which the flag-off keys never do.
 *
 * When a GraphQL-backed adapter lands this becomes a build- or config-time
 * choice here, and no container changes. That is the whole point of the port.
 */
let adapterPromise: Promise<DataProductAdapter> | null = null
function loadAdapter(): Promise<DataProductAdapter> {
  if (!adapterPromise) {
    adapterPromise = import('./fixtureAdapter').then((m) => m.fixtureAdapter)
  }
  return adapterPromise
}

// The cache keys on `input`; these resources take none beyond the ids below, so
// `key` is explicit rather than relying on `R.identity` over an object.
//
// `enabled` is part of the key, not a call-site branch, because hooks cannot be
// called conditionally: a caller that only wants products when a feature is on
// still has to call the hook every render. Keying on it means the disabled case
// resolves to `[]` **without touching the adapter**, so a deployment with the
// feature off makes no request once a real adapter lands. Gating at the call
// site instead would fetch first and discard after.
// The `@ts-expect-error`s below are the repo's existing shape for this:
// `utils/ResourceCache` is untyped JS and declares `key` as `R.identity`
// (`<T>(a: T) => T`), so any narrowing key function fails to assign. Same
// suppression `CatalogSettings` uses for the same reason.
const ProductsResource = Cache.createResource({
  name: 'DataProducts.list',
  fetch: ({ enabled }: { enabled: boolean }) =>
    enabled ? loadAdapter().then((a) => a.listProducts()) : Promise.resolve([]),
  // @ts-expect-error
  key: ({ enabled }: { enabled: boolean }) => enabled,
})

const ConnectionsResource = Cache.createResource({
  name: 'DataProducts.connections',
  fetch: ({ enabled }: { enabled: boolean }) =>
    enabled ? loadAdapter().then((a) => a.listConnections()) : Promise.resolve([]),
  // @ts-expect-error
  key: ({ enabled }: { enabled: boolean }) => enabled,
})

const ProductResource = Cache.createResource({
  name: 'DataProducts.product',
  fetch: ({ id }: { id: string }) => loadAdapter().then((a) => a.getProduct(id)),
  // @ts-expect-error
  key: ({ id }: { id: string }) => id,
})

const RequestsResource = Cache.createResource({
  name: 'DataProducts.requests',
  fetch: ({ productId }: { productId: string }) =>
    loadAdapter().then((a) => a.listRequests(productId)),
  // @ts-expect-error
  key: ({ productId }: { productId: string }) => productId,
})

// Keyed on the pair, because contents belong to a member and a product may have
// several. The `::` separator is safe: a product id is synthesized from the
// binding and a member's logical name comes from the platform, and neither
// contains it -- but even a collision would only over-share within one product,
// never across products, because the product id comes first.
const ContentsResource = Cache.createResource({
  name: 'DataProducts.contents',
  fetch: ({ productId, member }: { productId: string; member: string }) =>
    // A non-browsing adapter is not an error state: some platforms cannot
    // enumerate contents at all. NOT_FOUND is the honest answer -- we have no way
    // to look, so we did not find anything -- and it keeps the UI on one code
    // path rather than branching on adapter shape at every call site.
    loadAdapter().then((a) =>
      supportsBrowsing(a)
        ? a.listContents(productId, member)
        : ({ ok: false, reason: 'NOT_FOUND' } as ContentsResult),
    ),
  // @ts-expect-error
  key: ({ productId, member }: { productId: string; member: string }) =>
    `${productId}::${member}`,
})

type EntryInput = { productId: string; member: string; logicalKey: string }

const EntryBodyResource = Cache.createResource({
  name: 'DataProducts.entryBody',
  fetch: ({ productId, member, logicalKey }: EntryInput) =>
    // Same reasoning as contents: an adapter that cannot fetch is a real shape,
    // not a broken one, and NOT_FOUND keeps the UI on one path rather than
    // branching on adapter capability at the call site.
    loadAdapter().then((a) =>
      supportsFetching(a)
        ? a.fetchEntry(productId, member, logicalKey)
        : ({ ok: false, reason: 'NOT_FOUND' } as EntryBodyResult),
    ),
  // @ts-expect-error
  key: ({ productId, member, logicalKey }: EntryInput) =>
    `${productId}::${member}::${logicalKey}`,
})

/**
 * Every product this user can see, readable or not.
 *
 * `enabled` exists because hooks cannot be called conditionally: a caller gated
 * on a feature flag still runs this every render. Passing `false` resolves to
 * `[]` without reaching the adapter -- see the note on `ProductsResource`.
 */
export function useProducts(enabled = true): DataProduct[] {
  return Cache.useData(ProductsResource, { enabled }, { suspend: true }) as DataProduct[]
}

/**
 * Catalog connections an admin has configured.
 *
 * Through the port for the same reason as everything else here: the admin screen
 * reads live integration status, so a container reaching into `fixtures` would
 * keep reporting invented connections -- including a fabricated auth failure --
 * after a real adapter lands.
 */
export function useConnections(enabled = true): Connection[] {
  return Cache.useData(
    ConnectionsResource,
    { enabled },
    { suspend: true },
  ) as Connection[]
}

/**
 * One product, or `null` when it is not there.
 *
 * `null` is data, not an error: synthesized ids are not stable across renames,
 * so a miss is ordinary drift and callers redirect rather than showing a 404.
 */
export function useProduct(id: string): DataProduct | null {
  return Cache.useData(ProductResource, { id }, { suspend: true }) as DataProduct | null
}

/** Requests recorded against a product. Always answerable -- the record is Quilt's. */
export function useRequests(productId: string): AccessRequest[] {
  return Cache.useData(
    RequestsResource,
    { productId },
    { suspend: true },
  ) as AccessRequest[]
}

/**
 * One entry's bytes, or the reason they are unavailable.
 *
 * Keyed on the triple. Note the cache means opening the same file twice is one
 * fetch -- worth having, because a broker read costs a credential exchange rather
 * than just a round trip.
 */
export function useEntryBody(
  productId: string,
  member: string,
  logicalKey: string,
): EntryBodyResult {
  return Cache.useData(
    EntryBodyResource,
    { productId, member, logicalKey },
    { suspend: true },
  ) as EntryBodyResult
}

/**
 * Entries in one member, or the reason there are none.
 *
 * Suspends like the others. Note it does **not** take the member object -- only
 * its logical name -- so the cache key stays a string pair and two renders of the
 * same member share one fetch rather than keying on object identity.
 */
export function useContents(productId: string, member: string): ContentsResult {
  return Cache.useData(
    ContentsResource,
    { productId, member },
    { suspend: true },
  ) as ContentsResult
}

const AdapterResource = Cache.createResource({
  name: 'DataProducts.adapter',
  fetch: () => loadAdapter(),
  // @ts-expect-error
  key: () => 'adapter',
})

/**
 * The adapter itself, for the one thing hooks cannot express: asking whether a
 * write path exists.
 *
 * Exposed so a container can call `supportsRequests(useAdapter())` and disable
 * its submit affordance honestly, instead of hardcoding "no adapter yet".
 *
 * Suspends, like the rest: the adapter is loaded on demand so it stays out of
 * the chunks a flag-off deployment downloads. Only call it where the product
 * screens already suspend -- never to decide whether to show them.
 */
export function useAdapter(): DataProductAdapter {
  return Cache.useData(AdapterResource, {}, { suspend: true }) as DataProductAdapter
}
