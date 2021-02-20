import * as React from 'react'

import * as errors from 'containers/Bucket/errors'
import * as requests from 'containers/Bucket/requests'
import * as AWS from 'utils/AWS'
import yaml from 'utils/yaml'

const QUERIES_CONFIG_PATH = '.quilt/queries/config.yaml'

export interface Query {
  content: string
  description?: string
  key: string
  name: string
  url: string
}

export interface Config {
  queries: Record<string, Omit<Query, 'key'>>
  version: string
}

interface QueriesConfigArgs {
  s3: any
  bucket: string
}

export const queriesConfig = async ({
  s3,
  bucket,
}: QueriesConfigArgs): Promise<Config | null> => {
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

export function useQueriesConfig() {
  const [loading, setLoading] = React.useState(false)
  const [queriesList, setQueriesList] = React.useState<Query[] | null>(null)

  const s3 = AWS.S3.use()

  React.useEffect(() => {
    setLoading(true)
    queriesConfig({ s3, bucket: 'fiskus-sandbox-dev' })
      .then((config) => {
        if (!config) return
        const queries = Object.entries(config.queries).map(([key, value]) => ({
          key,
          ...value,
        }))
        setQueriesList(queries)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [s3, setLoading, setQueriesList])

  return {
    loading,
    queriesList,
  }
}
