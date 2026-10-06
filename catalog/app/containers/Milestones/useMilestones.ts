import * as React from 'react'

import * as GQL from 'utils/GraphQL'

import { deriveBadges, toMetrics, type Badge } from './badges'
import MILESTONES_QUERY from './gql/Milestones.generated'

/** `undefined` while loading. */
export default function useMilestones(): Badge[] | undefined {
  const result = GQL.useQuery(MILESTONES_QUERY)
  const { data, fetching, error, operation } = result
  return React.useMemo(() => {
    const metrics = GQL.fold(
      { data, fetching, error, operation },
      { data: toMetrics, fetching: () => undefined, error: () => null },
    )
    return metrics === undefined ? undefined : deriveBadges(metrics)
  }, [data, fetching, error, operation])
}
