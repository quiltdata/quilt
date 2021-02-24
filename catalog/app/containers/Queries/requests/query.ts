import * as React from 'react'

import * as errors from 'containers/Bucket/errors'
import * as requests from 'containers/Bucket/requests'
import * as AWS from 'utils/AWS'
import * as s3paths from 'utils/s3paths'

interface QueryArgs {
  s3: any
  queryUrl: string
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

export function useQuery(queryUrl: string) {
  const [loadingUrl, setLoadingUrl] = React.useState('')
  const [result, setResult] = React.useState<object | null>(null)

  const s3 = AWS.S3.use()

  React.useEffect(() => {
    if (loadingUrl === queryUrl) return

    if (!queryUrl) {
      if (result) setResult(null)
      return
    }

    setLoadingUrl(queryUrl)
    query({ s3, queryUrl })
      .then((queryObj) => {
        if (!queryObj) return
        setResult(queryObj)
      })
      .finally(() => {
        setLoadingUrl('')
      })
  }, [loadingUrl, queryUrl, result, s3, setLoadingUrl, setResult])

  return {
    loading: Boolean(loadingUrl),
    result,
  }
}
