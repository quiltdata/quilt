import * as errors from 'containers/Bucket/errors'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'

import { ElasticSearchQuery } from './query'
import { AsyncData } from './requests'

interface SearchArgs {
  req: $TSFixMe
  query: ElasticSearchQuery | string
}

export type ElasticSearchResults = object | null

type ElasticSearchRequestData = {
  action: 'freeform'
  body: string
  filter_path: string
  from?: number
  index: string
  size?: number
}

async function search({ req, query }: SearchArgs): Promise<ElasticSearchResults> {
  try {
    if (typeof query === 'string' || !query) throw new Error('Query is incorrect')
    const requestOptions: ElasticSearchRequestData = {
      index: query.index,
      filter_path: query.filter_path,
      action: 'freeform',
      body: JSON.stringify(query.body),
    }
    if (query.size) requestOptions.size = query.size
    if (query.from) requestOptions.from = query.size
    return req('/search', requestOptions)
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

export function useSearch(
  query: ElasticSearchQuery | string,
): AsyncData<ElasticSearchResults> {
  const req = AWS.APIGateway.use()
  return useData(search, { req, query }, { noAutoFetch: !query })
}
