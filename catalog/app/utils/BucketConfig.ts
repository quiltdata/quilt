import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import * as urql from 'urql'

import * as AuthSelectors from 'containers/Auth/selectors'
import * as Config from 'utils/Config'
import * as NamedRoutes from 'utils/NamedRoutes'
import { useRoute } from 'utils/router'

import BUCKET_CONFIGS_QUERY from './BucketConfigList.generated'

// always suspended
function useBucketConfigs() {
  const cfg = Config.use()
  const authenticated = redux.useSelector(AuthSelectors.authenticated)
  // XXX: consider moving this logic to gql resolver
  const empty = cfg.mode === 'MARKETING' || (cfg.alwaysRequiresAuth && !authenticated)

  const [{ data }] = urql.useQuery({
    query: BUCKET_CONFIGS_QUERY,
    pause: empty,
    variables: { includeCollaborators: cfg.mode === 'PRODUCT' },
  })

  return React.useMemo(() => {
    if (empty) return []
    return data?.bucketConfigs || []
  }, [empty, data?.bucketConfigs])
}

// XXX: consider deprecating this in favor of direct graphql usage
export const useRelevantBucketConfigs = () => {
  const bs = useBucketConfigs()
  return React.useMemo(() => {
    const filtered = bs.filter((b) => b.relevanceScore >= 0)
    const sorted = R.sortWith(
      [R.descend(R.prop('relevanceScore')), R.ascend(R.prop('name'))],
      filtered,
    )
    return sorted
  }, [bs])
}

export const useCurrentBucket = () => {
  const { paths } = NamedRoutes.use()
  const { match } = useRoute(paths.bucketRoot)
  return match && match.params.bucket
}

export function useIsInStack() {
  const bucketConfigs = useBucketConfigs()
  return React.useCallback(
    (bucket: string) => bucketConfigs.some((bc) => bc.name === bucket),
    [bucketConfigs],
  )
}
