import * as React from 'react'

interface Cases<Data> {
  Err?: (error: Error) => React.ReactNode
  Init?: () => React.ReactNode
  Ok?: (data: Data) => React.ReactNode
  _?: () => React.ReactNode
}

export interface AsyncData<Data> {
  case: (cases: Cases<Data>) => React.ReactElement
  result: $TSFixMe
}

export function useRequest<Response, Data>(
  loader: () => Promise<Response | null>,
  parser: (r: Response | null) => Data,
) {
  const [loading, setLoading] = React.useState(true)
  const [response, setResponse] = React.useState<Response | null>(null)
  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    setLoading(true)

    loader()
      .then((res) => {
        if (!res) return
        setResponse(res)
      })
      .catch(setError)
      .finally(() => {
        setLoading(false)
      })
  }, [loader])

  return React.useMemo(
    () => ({
      error,
      loading,
      value: parser(response),
    }),
    [error, loading, parser, response],
  )
}
