import * as R from 'ramda'
import * as React from 'react'

import * as errors from 'containers/Bucket/errors'
import * as requests from 'containers/Bucket/requests'
import * as AWS from 'utils/AWS'
import * as s3paths from 'utils/s3paths'

import { useRequest } from './requests'

interface QueryArgs {
  s3: any
  queryUrl: string
}

export interface QueryData {
  error: Error | null
  loading: boolean
  value: object | null
}

export const query = async ({ s3, queryUrl }: QueryArgs): Promise<object | null> => {
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

export function useQuery(queryUrl: string): QueryData {
  const s3 = AWS.S3.use()
  const loader = React.useCallback(async () => {
    if (!queryUrl) return null
    return query({ s3, queryUrl })
  }, [queryUrl, s3])
  return useRequest(loader, R.identity)
}
