export type RouteKind = 'Search' | 'Qurator'

// Natural-language routing for the unified search bar. Ported from the
// FrontDoor UnifiedBar (frontdoor/v3-eval) so the sidebar search bar shares the
// exact same classification behavior: a question or an imperative/NL phrase
// routes to Qurator, a short keyword phrase routes to catalog search.
const QURATOR_PREFIXES = new Set([
  'what',
  'where',
  'when',
  'who',
  'why',
  'how',
  'find',
  'show',
  'list',
  'summarize',
  'compare',
  'create',
  'run',
  'explain',
])

export function classifyQuery(query: string, quratorEnabled = true): RouteKind {
  if (!quratorEnabled) return 'Search'

  const trimmed = query.trim()
  if (!trimmed) return 'Search'
  if (trimmed.endsWith('?')) return 'Qurator'

  const words = trimmed.split(/\s+/).filter(Boolean)
  const firstWord = words[0]?.toLowerCase().replace(/[^a-z]/g, '')

  if (firstWord && QURATOR_PREFIXES.has(firstWord)) return 'Qurator'
  if (words.length >= 5) return 'Qurator'

  return 'Search'
}
