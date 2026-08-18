/**
 * Data Products: externally-owned products rendered inside Quilt.
 *
 * Products are defined and governed in an enterprise catalog (AWS DataZone,
 * Databricks Unity Catalog, Snowflake Horizon). Quilt reads and renders them;
 * the catalog owns every access decision.
 *
 * **Containers read through the hooks, never from `fixtures`.** `useProducts`,
 * `useProduct` and `useRequests` go via the adapter port, so replacing the
 * fixture adapter with a real one touches no container. `fixtures` stays
 * exported for specs and for the fixture adapter itself; a container importing
 * it has bypassed the port and will silently keep reading fixtures after a real
 * adapter lands.
 *
 * The read shape is documented in
 * `wb/dp-ui-slice-1/research/dp-read-shape-contract.md`.
 */

export * from './types'
export * from './requests'
export type { DataProductAdapter, RequestingAdapter } from './adapter'
export { supportsRequests } from './adapter'
export { useAdapter, useProduct, useProducts, useRequests } from './hooks'
export {
  CAPABILITIES,
  INTERSECTION,
  forMode,
  mayBranchOn,
  supportingPlatformCount,
} from './capabilities'
export * as fixtures from './fixtures'
