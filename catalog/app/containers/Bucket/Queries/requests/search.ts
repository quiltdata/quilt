import * as errors from 'containers/Bucket/errors'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'

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

export function useSearch(query: object | null): any {
  const req = AWS.APIGateway.use()
  return useData(search, { req, body: JSON.stringify(query) })
}
