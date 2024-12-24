import * as R from 'ramda'

import * as quiltConfigs from 'constants/quiltConfigs'
import * as errors from 'containers/Bucket/errors'
import * as requests from 'containers/Bucket/requests'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import * as YAML from 'utils/yaml'

import { AsyncData } from './requests'

// TODO: rename to requests.es.Query
export interface Query {
  description?: string
  key: string
  name: string
  url: string
}

type QueryResponse = Omit<Query, 'key'>

interface ConfigResponse {
  queries: Record<string, QueryResponse>
  version: string
}

interface QueriesConfigArgs {
  bucket: string
  s3: $TSFixMe
}

function isValidConfig(data: unknown): boolean {
  return R.is(Object, data) && R.is(Object, (data as { queries: unknown }).queries)
}

function parseQueriesList(result: unknown) {
  if (!isValidConfig(result)) return []

  return Object.entries((result as ConfigResponse).queries).map(([key, query]) => ({
    ...query,
    key,
  }))
}

export const queriesConfig = async ({
  s3,
  bucket,
}: QueriesConfigArgs): Promise<Query[] | null> => {
  try {
    const response = await requests.fetchFile({
      s3,
      handle: { bucket, key: quiltConfigs.esQueries },
    })
    // TODO: validate config with JSON Schema
    return parseQueriesList(YAML.parse(response.body?.toString('utf-8') || ''))
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
