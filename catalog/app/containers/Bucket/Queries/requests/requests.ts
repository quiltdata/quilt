import * as React from 'react'

interface Cases<Data> {
  Ok: (data: Data) => React.ReactElement
  Err: (error: Error) => React.ReactElement
  _: () => React.ReactElement
}

export interface AsyncData<Data> {
  case: (cases: Cases<Data>) => React.ReactElement
  result: any
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
