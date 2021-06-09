import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import * as urql from 'urql'

import * as AuthSelectors from 'containers/Auth/selectors'
import * as Model from 'model'
import * as Config from 'utils/Config'
import * as NamedRoutes from 'utils/NamedRoutes'
import { useRoute } from 'utils/router'

const BUCKET_CONFIGS_QUERY = urql.gql`
  query BucketConfigs {
    bucketConfigs {
      name
      title
      iconUrl
      description
      linkedData
      overviewUrl
      tags
      relevanceScore
    }
  }
`

type BucketConfig = Pick<
  Model.BucketConfig,
  | 'name'
  | 'title'
  | 'iconUrl'
  | 'description'
  | 'linkedData'
  | 'overviewUrl'
  | 'tags'
  | 'relevanceScore'
>

interface BucketConfigsData {
  bucketConfigs: BucketConfig[]
}

// always suspended
function useBucketConfigs() {
  const cfg = Config.use()
  const authenticated = redux.useSelector(AuthSelectors.authenticated)
  const empty = cfg.mode === 'MARKETING' || (cfg.alwaysRequiresAuth && !authenticated)

  const [{ data }] = urql.useQuery<BucketConfigsData>({
    query: BUCKET_CONFIGS_QUERY,
    pause: empty,
  })

  return React.useMemo(() => {
    if (empty) return []
    return data?.bucketConfigs || []
  }, [empty, data?.bucketConfigs])
}

// XXX: consider deprecating this in favor of direct graphql usage
export const useRelevantBucketConfigs = () => {
  const bs = useBucketConfigs()
  type BucketIterator = (buckets: typeof bs) => typeof bs
  return React.useMemo(
    () =>
      R.pipe(
        R.filter((b: BucketConfig) => b.relevanceScore >= 0) as BucketIterator,
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

export function useIsInStack() {
  const bucketConfigs = useBucketConfigs()
  return React.useCallback(
    (bucket: string) => bucketConfigs.some((bc) => bc.name === bucket),
    [bucketConfigs],
  )
}
