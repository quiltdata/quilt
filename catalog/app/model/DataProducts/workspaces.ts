/**
 * The workspace names, and nothing else.
 *
 * A module of its own so `hooks.ts` can name the active workspace **without a
 * static import of `fixtures.ts`**. That import is the whole reason this file
 * exists: `Buckets.jsx` imports the barrel, the barrel imports the hooks, and a
 * static edge from the hooks to the fixture tables pulls ~1300 lines of fixture
 * data into the volumes-landing chunk for every visitor, flag on or off. #5259
 * removed exactly that edge; this keeps it removed while still giving the hooks a
 * synchronous default (`useActiveWorkspace` cannot await).
 *
 * Anything with a body -- records, projections, the reach -- belongs in
 * `fixtures.ts` and is reached through the adapter, which loads lazily.
 */

export const WS_GENOMICS = 'fixture-ws-genomics'
export const WS_CLINICAL = 'fixture-ws-clinical'

/**
 * The workspaces this deployment offers a switch between.
 *
 * One is active at a time (model.md invariant 9); the switcher exists so that rule
 * can be seen rather than asserted.
 */
export const WORKSPACES = [WS_GENOMICS, WS_CLINICAL]

export const DEFAULT_WORKSPACE = WS_GENOMICS
