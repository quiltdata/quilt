import * as React from 'react'

import * as errors from 'containers/Bucket/errors'
import * as AWS from 'utils/AWS'

interface SearchArgs {
  req: any
  body: string
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

export function useSearch(query: object | null) {
  const [loadingQuery, setLoadingQuery] = React.useState<object | null>(null)
  const [result, setResult] = React.useState<object | null>(null)

  const req = AWS.APIGateway.use()

  React.useEffect(() => {
    if (loadingQuery === query) return

    if (!query) {
      if (result) setResult(null)
      return
    }

    setLoadingQuery(query)
    search({ req, body: JSON.stringify(query) })
      .then((results: any) => {
        if (!results) return
        setResult(results)
      })
      .finally(() => {
        setLoadingQuery(null)
      })
  }, [loadingQuery, query, req, result, setLoadingQuery, setResult])

  return {
    loading: Boolean(loadingQuery),
    result,
  }
}
