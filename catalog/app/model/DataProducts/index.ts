/**
 * Data products: volumes this stack's own registry defines.
 *
 * A data product is a virtual volume a workspace defines with a SQL definition
 * over the substrate it holds, publishes to a local exchange, and grants other
 * workspaces access to; a reader mints short-lived credentials against a capture
 * and reads through the proxy, as any S3 client does. The read shape and the
 * operation list are in `contrib/simon/creation-ux/model.md` (rev 2); the API this
 * layer is written against is its `api/README.md`, which is a proposal until the
 * registry's schema rules on it.
 *
 * **Containers read through the hooks, never from `fixtures`.** `useVolumes`,
 * `useVolume`, `useExchange` and the write hooks go via the adapter port, so
 * replacing the fixture adapter with a real one touches no container. `fixtures`
 * stays exported for specs and for the fixture adapter itself; a container
 * importing it has bypassed the port and will silently keep reading fixtures
 * after a real adapter lands.
 *
 * Two exports whose absence would be worse than their awkwardness:
 * `IS_FIXTURE_DATA`, so every surface can label what it renders, and
 * `UNAVAILABLE_ACTS`, so a write that nothing serves says so rather than
 * appearing to work.
 */

export * from './types'
export * from './state'
export * from './unavailable'
export type {
  ActRefused,
  ActUnavailable,
  DataProductAdapter,
  DefinitionCheck,
  MintResult,
  MintingAdapter,
  PublishingAdapter,
  SubscribingAdapter,
  WriteFailure,
} from './adapter'
export { supportsMinting, supportsPublishing, supportsSubscribing } from './adapter'
export { checkDefinition, referencedBuckets } from './fixtureAdapter'
export type { WriteState } from './hooks'
export {
  IS_FIXTURE_DATA,
  WORKSPACES,
  setActiveWorkspace,
  useActiveWorkspace,
  useAdapter,
  useDefinitionCheck,
  useExchange,
  usePublishing,
  useSubscribing,
  useVolume,
  useVolumes,
  useWorkspaceReach,
  useWrite,
} from './hooks'
