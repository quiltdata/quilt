import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'

import * as AuthSelectors from 'containers/Auth/selectors'
import * as APIConnector from 'utils/APIConnector'
import * as Config from 'utils/Config'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Cache from 'utils/ResourceCache'
import { useRoute } from 'utils/router'

export const BucketsResource = Cache.createResource({
  name: 'BucketConfig.buckets',
  fetch: async ({ req, empty }) => {
    if (empty) return []
    const res = await req({ endpoint: '/buckets' })
    return res.buckets.map((b) => ({
      ...R.omit(['icon_url', 'overview_url', 'relevance_score', 'schema_org'], b),
      iconUrl: b.icon_url,
      overviewUrl: b.overview_url,
      relevance: b.relevance_score,
      linkedData: b.schema_org,
    }))
  },
  key: ({ empty, session }) => ({ empty, session }),
})

export function useBucketConfigs({ suspend = true } = {}) {
  const cfg = Config.use()
  const authenticated = redux.useSelector(AuthSelectors.authenticated)
  const empty = cfg.mode === 'MARKETING' || (cfg.alwaysRequiresAuth && !authenticated)
  const sessionId = redux.useSelector(AuthSelectors.sessionId)
  const session = cfg.alwaysRequiresAuth && sessionId
  const req = APIConnector.use()
  return Cache.useData(BucketsResource, { req, empty, session }, { suspend })
}

export const useRelevantBucketConfigs = () => {
  const bs = useBucketConfigs()
  return React.useMemo(
    () =>
      R.pipe(
        // TODO: filter-out buckets with relevance == null?
        R.filter((b) => b.relevance == null || b.relevance >= 0),
        R.sortWith([R.descend(R.prop('relevance')), R.ascend(R.prop('name'))]),
      )(bs),
    [bs],
  )
}

export const useCurrentBucket = () => {
  const { paths } = NamedRoutes.use()
  const { match } = useRoute(paths.bucketRoot)
  return match && match.params.bucket
}

export const useCurrentBucketConfig = () => {
  const bucket = useCurrentBucket()
  const bucketConfigs = useBucketConfigs()
  return bucket && bucketConfigs.find((i) => i.name === bucket)
}

export function useInStackBuckets() {
  const bucketConfigs = useBucketConfigs()
  return React.useMemo(() => R.pluck('name', bucketConfigs), [bucketConfigs])
}

export function useIsInStack() {
  const buckets = useInStackBuckets()
  // eslint-disable-next-line no-underscore-dangle
  return React.useCallback(R.includes(R.__, buckets), [buckets])
}
