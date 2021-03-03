import * as errors from 'containers/Bucket/errors'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'

import { ElasticSearchQuery } from './query'
import { AsyncData } from './requests'

interface SearchArgs {
  req: $TSFixMe
  body: string
}

export type ElasticSearchResults = object | null

async function search({ req, body }: SearchArgs): Promise<ElasticSearchResults> {
  try {
    return req('/search', { index: '*', action: 'search', body })
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
  return useData(search, { req, body: JSON.stringify(query) }, { noAutoFetch: !query })
}
