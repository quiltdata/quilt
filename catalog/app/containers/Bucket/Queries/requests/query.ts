import * as errors from 'containers/Bucket/errors'
import * as requests from 'containers/Bucket/requests'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import * as s3paths from 'utils/s3paths'

import { AsyncData } from './requests'

interface QueryArgs {
  s3: any
  queryUrl: string
}

export type ElasticSearchQuery = object | null

export const query = async ({ s3, queryUrl }: QueryArgs): Promise<ElasticSearchQuery> => {
  const { bucket, key, version } = s3paths.parseS3Url(queryUrl)
  try {
    const response = await requests.fetchFile({ s3, bucket, path: key, version })
    return JSON.parse(response.Body.toString('utf-8'))
  } catch (e) {
    if (e instanceof errors.FileNotFound || e instanceof errors.VersionNotFound)
      return null

    // eslint-disable-next-line no-console
    console.log('Unable to fetch')
    // eslint-disable-next-line no-console
    console.error(e)
    throw e
  }
}

export function useQuery(queryUrl: string): AsyncData<ElasticSearchQuery> {
  const s3 = AWS.S3.use()
  return useData(query, { s3, queryUrl }, { noAutoFetch: !queryUrl })
}
