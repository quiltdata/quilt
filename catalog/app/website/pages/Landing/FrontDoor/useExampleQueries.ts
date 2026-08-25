import * as React from 'react'

import { useRelevantBuckets } from 'utils/Buckets'

import useRecentlyRevisedPackages from './useRecentlyRevisedPackages'

export interface ExampleQuery {
  icon: string
  label: string
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

// Derive a short, human-readable keyword from a package handle's last segment,
// e.g. "alexwilson/drugbank-test" -> "drugbank test".
function packageKeyword(name: string): string {
  const tail = name.split('/').pop() || name
  return tail.replace(/[-_]+/g, ' ').trim()
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
    const out: ExampleQuery[] = []
    const seen = new Set<string>()

    const add = (icon: string, label: string) => {
      const key = label.toLowerCase()
      if (!label || seen.has(key) || out.length >= limit) return
      seen.add(key)
      out.push({ icon, label })
    }

    // 1. Recently-revised packages -> "explore" prompts anchored to real data.
    packages.forEach((pkg) => {
      const keyword = packageKeyword(pkg.name)
      if (keyword) add('inventory_2', `What's in the ${keyword} package?`)
    })

    // 2. Bucket tags -> topical prompts ("Summarize <tag> data").
    const tags = buckets.flatMap((b) => b.tags || [])
    Array.from(new Set(tags)).forEach((tag) => {
      add('summarize', `Summarize the ${tag} data across my buckets`)
    })

    // 3. Bucket titles -> direct exploration prompts.
    buckets.forEach((b) => {
      add('folder', `Show me the latest packages in ${b.title || b.name}`)
    })

    // 4. Top up with generic fallbacks so the bar is never under-filled.
    DEFAULT_EXAMPLES.forEach((ex) => add(ex.icon, ex.label))

    return out.slice(0, limit)
  }, [buckets, packages, limit])
}
