import * as React from 'react'

import { SearchResultOrder } from 'model/graphql/types.generated'
import * as GQL from 'utils/GraphQL'

import RECENT_PACKAGES_QUERY from './gql/RecentPackages.generated'

export interface RevisedPackage {
  id: string
  bucket: string
  name: string
  hash: string
  pointer: string
  modified: Date
}

export interface RecentlyRevisedState {
  fetching: boolean
  error: boolean
  packages: RevisedPackage[]
}

// How many recently-revised packages the tile renders. Bounded to keep the
// landing tile compact regardless of how many results the server returns.
export const RECENT_PACKAGES_LIMIT = 5

/**
 * Server-backed "recently revised" packages, ordered newest-first across all
 * accessible buckets. Unlike the legacy `useRecentPackages` hook (which reads
 * browser-local open history), this reflects the latest revisions on the server.
 */
export default function useRecentlyRevisedPackages(
  limit: number = RECENT_PACKAGES_LIMIT,
): RecentlyRevisedState {
  const result = GQL.useQuery(RECENT_PACKAGES_QUERY, {
    buckets: null,
    order: SearchResultOrder.NEWEST,
  })

  return React.useMemo(
    () =>
      GQL.fold(result, {
        data: (data, { fetching }): RecentlyRevisedState => {
          const r = data.searchPackages
          if (r.__typename !== 'PackagesSearchResultSet') {
            return {
              fetching,
              error: r.__typename !== 'EmptySearchResultSet',
              packages: [],
            }
          }
          const packages = r.firstPage.hits.slice(0, limit).map((hit) => ({
            id: hit.id,
            bucket: hit.bucket,
            name: hit.name,
            hash: hit.hash,
            pointer: hit.pointer,
            modified: hit.modified,
          }))
          return { fetching, error: false, packages }
        },
        fetching: (): RecentlyRevisedState => ({
          fetching: true,
          error: false,
          packages: [],
        }),
        error: (): RecentlyRevisedState => ({
          fetching: false,
          error: true,
          packages: [],
        }),
      }),
    [limit, result],
  )
}
