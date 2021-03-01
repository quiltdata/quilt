import * as React from 'react'

import * as errors from 'containers/Bucket/errors'
import * as requests from 'containers/Bucket/requests'
import * as AWS from 'utils/AWS'
import yaml from 'utils/yaml'

import { useRequest } from './requests'

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

function parseQueriesList(result: ConfigResponse | null) {
  if (!result || !result.queries) return []

  return Object.entries(result.queries).map(([key, query]) => ({
    ...query,
    body: null,
    key,
  }))
}

export function useQueriesConfig(bucket: string): ConfigData {
  const s3 = AWS.S3.use()
  const loader = React.useCallback(() => queriesConfig({ s3, bucket }), [bucket, s3])
  return useRequest(loader, parseQueriesList)
}
