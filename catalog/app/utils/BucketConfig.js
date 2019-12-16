import * as R from 'ramda'
import * as React from 'react'

import * as Config from 'utils/Config'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Cache from 'utils/ResourceCache'
import { useRoute } from 'utils/router'

const fetchBuckets = async ({ registryUrl }) => {
  const res = await fetch(`${registryUrl}/api/buckets`)
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Unable to fetch buckets (${res.status}):\n${text}`)
  }
  const json = JSON.parse(text)
  return json.buckets.map((b) => ({
    ...R.omit(['icon_url', 'overview_url', 'relevance_score', 'schema_org'], b),
    iconUrl: b.icon_url,
    overviewUrl: b.overview_url,
    relevance: b.relevance_score,
    linkedData: b.schema_org,
  }))
}

const BucketsResource = Cache.createResource({
  name: 'BucketConfig.buckets',
  fetch: fetchBuckets,
})

export const useBucketConfigs = ({ suspend = true } = {}) =>
  Cache.useData(BucketsResource, { registryUrl: Config.use().registryUrl }, { suspend })

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
