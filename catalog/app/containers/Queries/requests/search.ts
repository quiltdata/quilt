import * as R from 'ramda'
import * as React from 'react'

import * as errors from 'containers/Bucket/errors'
import * as AWS from 'utils/AWS'

import { useRequest } from './requests'

interface SearchArgs {
  req: any
  body: string
}

export interface ResultsData {
  error: Error | null
  loading: boolean
  value: object | null
}

async function search({ req, body }: SearchArgs) {
  try {
    const result = await req('/search', { index: '*', action: 'search', body })
    return result
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

export function useSearch(query: object | null): ResultsData {
  const req = AWS.APIGateway.use()
  const loader = React.useCallback(async () => {
    if (!query) return null
    return search({ req, body: JSON.stringify(query) })
  }, [query, req])
  return useRequest(loader, R.identity)
}
