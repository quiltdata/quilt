import * as errors from 'containers/Bucket/errors'
import * as requests from 'containers/Bucket/requests'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import yaml from 'utils/yaml'

import { AsyncData } from './requests'

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
  bucket: string
  s3: $TSFixMe
}

function parseQueriesList(result: ConfigResponse | null) {
  if (!result || !result.queries) return []

  return Object.entries(result.queries).map(([key, query]) => ({
    ...query,
    body: null,
    key,
  }))
}

export const queriesConfig = async ({
  s3,
  bucket,
}: QueriesConfigArgs): Promise<Query[] | null> => {
  try {
    const response = await requests.fetchFile({ s3, bucket, path: QUERIES_CONFIG_PATH })
    return parseQueriesList(yaml(response.Body.toString('utf-8')))
  } catch (e) {
    if (e instanceof errors.FileNotFound || e instanceof errors.VersionNotFound) return []

    // eslint-disable-next-line no-console
    console.log('Unable to fetch')
    // eslint-disable-next-line no-console
    console.error(e)
    throw e
  }
}

export function useQueriesConfig(bucket: string): AsyncData<Query[]> {
  const s3 = AWS.S3.use()
  return useData(queriesConfig, { s3, bucket })
}
