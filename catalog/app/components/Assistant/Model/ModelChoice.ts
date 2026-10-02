import * as React from 'react'

import * as GQL from 'utils/GraphQL'

import QURATOR_MODELS_QUERY from './gql/QuratorModels.generated'

/** The models an admin has approved for Qurator on this stack, and their default. */
export interface Governed {
  allowlist: readonly string[]
  default: string | null
}

/**
 * The governed set, or `null` when no admin has written one. A read that is
 * still in flight or failed is also `null`: the registry's inference relay
 * enforces the set either way, so the catalog falling back is cosmetic only.
 */
export function useGoverned(): Governed | null {
  const query = GQL.useQuery(QURATOR_MODELS_QUERY)
  return React.useMemo(
    () =>
      GQL.fold(query, {
        data: ({ config: { quratorModels: m } }) =>
          m?.allowlist ? { allowlist: m.allowlist, default: m.default } : null,
        fetching: () => null,
        error: () => null,
      }),
    [query],
  )
}

/**
 * The model a turn runs on. Ungoverned, a browser override wins over the
 * stack's default, as it always has. Governed, an override counts only while
 * it is still allowed; otherwise the admin's default stands in for it.
 */
export function resolve(
  governed: Governed | null,
  override: string,
  fallback: string,
): string {
  if (!governed) return override || fallback
  const { allowlist } = governed
  if (override && allowlist.includes(override)) return override
  if (governed.default && allowlist.includes(governed.default)) return governed.default
  return allowlist.includes(fallback) ? fallback : allowlist[0]
}

/** Whether a stored override should be dropped rather than kept for later. */
export function isStale(governed: Governed | null, override: string): boolean {
  return !!governed && !!override && !governed.allowlist.includes(override)
}
