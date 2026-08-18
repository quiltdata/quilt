/**
 * Data Products: externally-owned products rendered inside Quilt.
 *
 * Products are defined and governed in an enterprise catalog (AWS DataZone,
 * Databricks Unity Catalog, Snowflake Horizon). Quilt reads and renders them;
 * the catalog owns every access decision.
 *
 * Adapters do not exist yet -- `fixtures` stands in for them while the UX is
 * built. The read shape is documented in
 * `wb/dp-ui-slice-1/research/dp-read-shape-contract.md`.
 */

export * from './types'
export * from './requests'
export {
  CAPABILITIES,
  INTERSECTION,
  forMode,
  mayBranchOn,
  supportingPlatformCount,
} from './capabilities'
export * as fixtures from './fixtures'
