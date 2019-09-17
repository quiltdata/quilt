import * as Config from 'utils/Config'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Cache from 'utils/ResourceCache'
import { useRoute } from 'utils/router'

const fetchBuckets = async ({ registryUrl }) => {
  // TODO: use api/buckets endpoint once it's working
  const res = await fetch(`${registryUrl}/api/buckets`)
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Unable to fetch buckets (${res.status}):\n${text}`)
  }
  const json = JSON.parse(text)
  // console.log('json', json)
  /*
  TODO: new shape:
  {
    name
    icon
    title
    description
    overviewUrl *new
    tags *new
    relevance *new
  }
  */
  return json.buckets
}

const BucketsResource = Cache.createResource({
  name: 'BucketConfig.buckets',
  fetch: fetchBuckets,
})

export const useBucketConfigs = ({ suspend = true } = {}) =>
  Cache.useData(BucketsResource, { registryUrl: Config.use().registryUrl }, { suspend })

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
