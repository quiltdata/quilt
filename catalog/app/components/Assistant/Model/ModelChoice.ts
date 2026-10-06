import * as React from 'react'

import * as GQL from 'utils/GraphQL'

import QURATOR_MODELS_QUERY from './gql/QuratorModels.generated'

/** The models an admin has approved for Qurator on this stack, and their default. */
export interface Governed {
  allowlist: readonly string[]
  default: string | null
  names?: Readonly<Record<string, string>>
}

/**
 * The governed set, or `null` when no admin has written one, and whether the
 * read has settled. A failed read settles, so a waiting turn is not held
 * forever, and is flagged so the turn avoids a stored model the set may refuse.
 * Nothing retries it: the flag holds until a reload or sign-in reads again.
 */
export function useGoverned(): {
  governed: Governed | null
  settled: boolean
  failed: boolean
} {
  const query = GQL.useQuery(QURATOR_MODELS_QUERY)
  return React.useMemo(
    () =>
      GQL.fold(query, {
        data: ({ config: { quratorModels: m } }) => ({
          governed: m?.allowlist
            ? {
                allowlist: m.allowlist,
                default: m.default,
                names: Object.fromEntries((m.names ?? []).map((n) => [n.id, n.name])),
              }
            : null,
          settled: true,
          failed: false,
        }),
        fetching: () => ({ governed: null, settled: false, failed: false }),
        error: () => ({ governed: null, settled: true, failed: true }),
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
  readFailed = false,
): string {
  // Whether a set exists is unknown, and the relay refuses a stored override
  // outside one, so the stack's default is the model most likely to be allowed.
  if (readFailed) return fallback
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

const TIERS: readonly [RegExp, string][] = [
  [/opus/i, 'Heavy'],
  [/sonnet/i, 'Medium'],
  [/haiku/i, 'Light'],
]

const SAGEMAKER_ENDPOINT = /^arn:aws[a-z-]*:sagemaker:[^:]*:\d{12}:endpoint\/(.+)$/

/** A coarse weight class for a Bedrock model id, when its family name implies one. */
export function tier(id: string): string | null {
  if (SAGEMAKER_ENDPOINT.test(id)) return null
  return TIERS.find(([re]) => re.test(id))?.[1] ?? null
}

/**
 * A readable name for a Bedrock model id: region and vendor prefixes, the
 * release date and the version suffix dropped, so
 * `us.anthropic.claude-sonnet-4-5-20250929-v1:0` reads "Claude Sonnet 4.5".
 * A SageMaker endpoint ARN reads as its endpoint name, unstripped.
 */
export function displayName(id: string): string {
  const base =
    id.match(SAGEMAKER_ENDPOINT)?.[1] ??
    id
      // Every dot-terminated leading segment: `us.`, `us-gov.`, `global.`, the vendor.
      .replace(/^(?:[a-z0-9-]+\.)*/, '')
      .replace(/-\d{8}/, '')
      .replace(/-v\d+(?::\w+)*$/, '')
  const words: string[] = []
  for (const part of base.split('-').filter(Boolean)) {
    const prev = words[words.length - 1]
    // A version split by dashes: `4-5`, or `llama3-1` after a word ending in a digit.
    if (/^\d+$/.test(part) && prev && /\d$/.test(prev)) {
      words[words.length - 1] = `${prev}.${part}`
    } else {
      words.push(/^\d/.test(part) ? part : part[0].toUpperCase() + part.slice(1))
    }
  }
  return words.join(' ') || id
}

// Own keys only: an id such as `constructor` must not find a prototype method.
export const nameIn = (names: Readonly<Record<string, string>>, id: string) =>
  Object.prototype.hasOwnProperty.call(names, id) ? names[id] : undefined

/**
 * "Medium · Claude Sonnet 4.5", or just the name when no tier applies. An
 * admin's display name stands alone: the admin chose it whole.
 */
export function label(id: string, name?: string): string {
  if (name) return name
  const t = tier(id)
  return t ? `${t} · ${displayName(id)}` : displayName(id)
}
