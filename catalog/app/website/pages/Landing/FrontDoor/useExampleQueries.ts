import * as React from 'react'

import { useRelevantBuckets } from 'utils/Buckets'

import useRecentlyRevisedPackages from './useRecentlyRevisedPackages'

export interface ExampleQuery {
  /** Material icon ligature, rendered in the outlined face. */
  icon: string
  /** The query itself: typed into the search bar verbatim when the chip is clicked. */
  label: string
  /** Substring of {@link ExampleQuery.label} to set apart as an identifier when rendered. */
  code?: string
}

// How many chips the bar renders.
export const EXAMPLE_LIMIT = 5

// Generic fallbacks shown before catalog data resolves (or when it is too
// sparse to derive enough relevant prompts). These mirror the original static
// set so the bar is never empty.
export const DEFAULT_EXAMPLES: ExampleQuery[] = [
  {
    icon: 'biotech',
    label: 'Find ovarian cancer cell lines in CCLE and compare mutation rates',
  },
  { icon: 'summarize', label: 'Summarize research on BRCA1 mutations' },
  { icon: 'inventory', label: 'Create a package from my STARsolo outputs' },
  {
    icon: 'table_chart',
    label: 'Query the tcga_samples table for tumor counts by stage',
  },
  { icon: 'search', label: 'drugbank' },
]

/**
 * Round-robin share of `limit` across sources of the given sizes: each takes a
 * turn before any takes a second slot, and one that runs dry hands its turns to
 * the rest. So every kind of prompt shows while the row has room for it, and a
 * single kind still fills the row when it is the only one with anything to say.
 */
export function shareOut(sizes: number[], limit: number): number[] {
  const taken = sizes.map(() => 0)
  let total = 0
  let moved = true
  while (total < limit && moved) {
    moved = false
    sizes.forEach((size, i) => {
      if (total >= limit || taken[i] >= size) return
      taken[i] += 1
      total += 1
      moved = true
    })
  }
  return taken
}

/**
 * Builds example search prompts grounded in the catalog's actual contents:
 * the user's buckets, their tags, and recently-revised package names. Falls
 * back to a generic set when there isn't enough data to fill the bar, so the
 * prompts are always relevant to what the viewer can actually see.
 */
export default function useExampleQueries(limit: number = EXAMPLE_LIMIT): ExampleQuery[] {
  const buckets = useRelevantBuckets()
  const { packages } = useRecentlyRevisedPackages(limit)

  return React.useMemo(() => {
    const sources = [
      packages
        .filter((pkg) => pkg.name)
        .map((pkg) => ({
          icon: 'inventory_2',
          label: `What's in the ${pkg.name} package?`,
          code: pkg.name,
        })),
      Array.from(new Set(buckets.flatMap((b) => b.tags || []))).map((tag) => ({
        icon: 'summarize',
        label: `Summarize the ${tag} data across my buckets`,
      })),
      buckets.map((b) => ({
        icon: 'folder',
        label: `Show me the latest packages in ${b.title || b.name}`,
      })),
    ]
    const take = shareOut(
      sources.map((s) => s.length),
      limit,
    )

    const out: ExampleQuery[] = []
    const seen = new Set<string>()
    const add = (q: ExampleQuery) => {
      const key = q.label.toLowerCase()
      if (!q.label || seen.has(key) || out.length >= limit) return
      seen.add(key)
      out.push(q)
    }

    // Grouped by source rather than interleaved: the shares decide how many of
    // each show, the order keeps like chips adjacent.
    sources.forEach((source, i) => source.slice(0, take[i]).forEach(add))
    DEFAULT_EXAMPLES.forEach(add)
    return out
  }, [buckets, packages, limit])
}
