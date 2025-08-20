import * as React from 'react'

export const Idle = Symbol('idle')

export const Loading = Symbol('loading')

// TODO:
// re-use data helpers from `containers/Bucket/Queries/Athena/model/utils.ts`
// most useful, probably, is "isReady => when Error | T"

export type Result<T> = typeof Idle | typeof Loading | Error | T

export function useRequest<T>(req: () => Promise<T>, proceed: boolean = true): Result<T> {
  const [result, setResult] = React.useState<Result<T>>(Idle)

  const currentReq = React.useRef<Promise<T>>()

  React.useEffect(() => {
    if (!proceed) {
      setResult(Idle)
      currentReq.current = undefined
      return
    }

    setResult(Loading)

    const p = req()
    currentReq.current = p

    function handleResult(r: T | Error) {
      // if the request is not the current one, ignore the result
      if (currentReq.current === p) setResult(r)
    }

    p.then(handleResult, handleResult)
  }, [req, proceed])

  // cleanup on unmount
  React.useEffect(
    () => () => {
      currentReq.current = undefined
    },
    [],
  )

  return result
}

export const use = useRequest
