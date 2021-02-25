import * as React from 'react'

import * as errors from 'containers/Bucket/errors'
import * as AWS from 'utils/AWS'

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

export function useSearch(query: object | null) {
  const [error, setError] = React.useState<Error | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [result, setResult] = React.useState<object | null>(null)

  const req = AWS.APIGateway.use()

  React.useEffect(() => {
    if (!query) return

    setLoading(true)
    search({ req, body: JSON.stringify(query) })
      .then((results: any) => {
        if (!results) return
        setResult(results)
      })
      .catch(setError)
      .finally(() => {
        setLoading(false)
      })
  }, [query, req, setLoading, setResult])

  return React.useMemo(
    () => ({
      error,
      loading,
      value: result,
    }),
    [error, loading, result],
  )
}
