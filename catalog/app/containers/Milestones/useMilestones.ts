import * as React from 'react'

import * as GQL from 'utils/GraphQL'

import { deriveBadges, toMetrics, type Badge } from './badges'
import MILESTONES_QUERY from './gql/Milestones.generated'

/** `undefined` while loading. */
export default function useMilestones(): Badge[] | undefined {
  const result = GQL.useQuery(MILESTONES_QUERY)
  const metrics = GQL.fold(result, {
    data: toMetrics,
    fetching: () => undefined,
    error: () => null,
  })
  return React.useMemo(
    () => (metrics === undefined ? undefined : deriveBadges(metrics)),
    [metrics],
  )
}
