import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import { useRouteMatch } from 'react-router-dom'

import cfg from 'constants/config'
import * as AuthSelectors from 'containers/Auth/selectors'
import * as GQL from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'

import BUCKET_CONFIGS_QUERY from './BucketConfigList.generated'

type BucketConfigs = GQL.DataForDoc<typeof BUCKET_CONFIGS_QUERY>['bucketConfigs']

const EMPTY: BucketConfigs = []

// always suspended
function useBucketConfigs() {
  const authenticated = redux.useSelector(AuthSelectors.authenticated)
  // XXX: consider moving this logic to gql resolver
  const empty = cfg.alwaysRequiresAuth && !authenticated

  try {
    return GQL.useQueryS(
      BUCKET_CONFIGS_QUERY,
      { includeCollaborators: cfg.mode === 'PRODUCT' },
      { pause: empty },
    ).bucketConfigs
  } catch (e) {
    if (e instanceof GQL.Paused) return EMPTY
    throw e
  }
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
  return useRouteMatch<{ bucket: string }>(paths.bucketRoot)?.params.bucket
}

export function useIsInStack() {
  const bucketConfigs = useBucketConfigs()
  return React.useCallback(
    (bucket: string) => bucketConfigs.some((bc) => bc.name === bucket),
    [bucketConfigs],
  )
}
