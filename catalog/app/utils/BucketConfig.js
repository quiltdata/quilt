import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import * as Urql from 'urql'

import * as AuthSelectors from 'containers/Auth/selectors'
// import * as APIConnector from 'utils/APIConnector'
import * as Config from 'utils/Config'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Cache from 'utils/ResourceCache'
import { useRoute } from 'utils/router'

// TODO: remove this, rely on GraphQL
export const BucketsResource = Cache.createResource({
  name: 'BucketConfig.buckets',
  fetch: async ({ req, empty }) => {
    if (empty) return []
    const res = await req({ endpoint: '/buckets' })
    return res.buckets.map((b) => ({
      ...R.omit(['icon_url', 'overview_url', 'relevance_score', 'schema_org'], b),
      iconUrl: b.icon_url,
      overviewUrl: b.overview_url,
      relevanceScore: b.relevance_score,
      linkedData: b.schema_org,
    }))
  },
  key: ({ empty, session }) => ({ empty, session }),
})

const BUCKET_CONFIG_FRAG = `
  fragment BucketConfigProps on BucketConfig {
    title
    iconUrl
    description
    linkedData
    overviewUrl
    tags
    relevanceScore
    # snsNotificationArn
    # lastIndexed
    # scannerParallelShardsDepth
    # fileExtensionsToIndex
  }
`
const BUCKET_CONFIGS_QUERY = `
  ${BUCKET_CONFIG_FRAG}

  query BucketConfigs {
    buckets {
      name
      config {
        ...BucketConfigProps
      }
    }
  }
`

// TODO
// interface BucketConfig

// always suspended
export function useBucketConfigs() {
  const cfg = Config.use()
  const authenticated = redux.useSelector(AuthSelectors.authenticated)
  const empty = cfg.mode === 'MARKETING' || (cfg.alwaysRequiresAuth && !authenticated)
  // const sessionId = redux.useSelector(AuthSelectors.sessionId)
  // const session = cfg.alwaysRequiresAuth && sessionId
  // TODO: refetch / invalidate cache on session change

  const [{ data }] = Urql.useQuery({
    query: BUCKET_CONFIGS_QUERY,
    pause: empty,
  })

  const formattedData = React.useMemo(() => {
    if (empty) return []
    return (data?.buckets || []).map(({ name, config }) => ({ name, ...config }))
  }, [empty, data?.buckets])

  return formattedData
}

export const useRelevantBucketConfigs = () => {
  const bs = useBucketConfigs()
  return React.useMemo(
    () =>
      R.pipe(
        // TODO: filter-out buckets with relevanceScore == null?
        R.filter((b) => b.relevanceScore == null || b.relevanceScore >= 0),
        R.sortWith([R.descend(R.prop('relevanceScore')), R.ascend(R.prop('name'))]),
      )(bs),
    [bs],
  )
}

export const useCurrentBucket = () => {
  const { paths } = NamedRoutes.use()
  const { match } = useRoute(paths.bucketRoot)
  return match && match.params.bucket
}

const BUCKET_CONFIG_QUERY = `
  ${BUCKET_CONFIG_FRAG}

  query BucketConfig($bucket: String!) {
    bucket(name: $bucket) {
      name
      config {
        ...BucketConfigProps
      }
    }
  }
`

export const useCurrentBucketConfig = () => {
  const bucket = useCurrentBucket()
  const [{ data }] = Urql.useQuery({
    query: BUCKET_CONFIG_QUERY,
    variables: { bucket },
    pause: !bucket,
  })
  return bucket && data?.bucket?.config
}

export function useInStackBuckets() {
  const bucketConfigs = useBucketConfigs()
  return React.useMemo(() => R.pluck('name', bucketConfigs), [bucketConfigs])
}

export function useIsInStack() {
  const buckets = useInStackBuckets()
  return React.useMemo(() => R.includes(R.__, buckets), [buckets])
}
