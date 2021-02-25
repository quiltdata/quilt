import * as React from 'react'

import * as errors from 'containers/Bucket/errors'
import * as requests from 'containers/Bucket/requests'
import * as AWS from 'utils/AWS'
import yaml from 'utils/yaml'

const QUERIES_CONFIG_PATH = '.quilt/queries/config.yaml'

export interface Query {
  description?: string
  key: string
  name: string
  url: string
}

type QueryResponse = Omit<Query, 'key' | 'body'>

interface ConfigResponse {
  queries: Record<string, QueryResponse>
  version: string
}

interface QueriesConfigArgs {
  s3: any
  bucket: string
}

export interface ConfigData {
  error: Error | null
  loading: boolean
  value: Query[]
}

export const queriesConfig = async ({
  s3,
  bucket,
}: QueriesConfigArgs): Promise<ConfigResponse | null> => {
  try {
    const response = await requests.fetchFile({ s3, bucket, path: QUERIES_CONFIG_PATH })
    return yaml(response.Body.toString('utf-8'))
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

export function useQueriesConfig(): ConfigData {
  const [loading, setLoading] = React.useState(false)
  const [result, setResult] = React.useState<ConfigResponse | null>(null)
  const [error, setError] = React.useState<Error | null>(null)

  const s3 = AWS.S3.use()

  React.useEffect(() => {
    setLoading(true)
    queriesConfig({ s3, bucket: 'fiskus-sandbox-dev' })
      .then((config) => {
        if (!config) return
        setResult(config)
      })
      .catch(setError)
      .finally(() => {
        setLoading(false)
      })
  }, [s3])

  const queriesList = React.useMemo(() => {
    if (!result || !result.queries) return []

    return Object.entries(result.queries).map(([key, query]) => ({
      ...query,
      body: null,
      key,
    }))
  }, [result])

  return React.useMemo(
    () => ({
      error,
      loading,
      value: queriesList,
    }),
    [error, loading, queriesList],
  )
}
