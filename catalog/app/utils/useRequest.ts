import * as React from 'react'

export const Idle = Symbol('idle')

export const Loading = Symbol('loading')

// TODO:
// re-use data helpers from `containers/Bucket/Queries/Athena/model/utils.ts`
// most useful, probably, is "isReady => when Error | T"

export type Result<T> = typeof Idle | typeof Loading | Error | T

export interface RequestResult<T> {
  result: Result<T>
  refetch: () => void
}

export function useRequest<T>(
  req: (signal: AbortSignal) => Promise<T>,
  proceed: boolean = true,
): RequestResult<T> {
  const [result, setResult] = React.useState<Result<T>>(Idle)
  const [refetchTrigger, setRefetchTrigger] = React.useState(0)

  const currentReq = React.useRef<Promise<T>>()
  const currentController = React.useRef<AbortController>()

  React.useEffect(() => {
    if (!proceed) {
      setResult(Idle)
      currentReq.current = undefined
      if (currentController.current) {
        currentController.current.abort()
      }
      currentController.current = undefined
      return
    }

    setResult(Loading)

    const controller = new AbortController()
    currentController.current = controller

    const p = req(controller.signal)
    currentReq.current = p

    function handleResult(r: T | Error) {
      // if the request is not the current one, ignore the result
      if (currentReq.current === p && !controller.signal.aborted) {
        setResult(r)
      }
    }

    p.then(handleResult, handleResult)

    return () => {
      if (!controller.signal.aborted) {
        controller.abort()
      }
    }
  }, [req, proceed, refetchTrigger])

  // cleanup on unmount
  React.useEffect(
    () => () => {
      currentReq.current = undefined
      if (currentController.current && !currentController.current.signal.aborted) {
        currentController.current.abort()
      }
      currentController.current = undefined
    },
    [],
  )

  const refetch = React.useCallback(() => {
    setRefetchTrigger((prev) => prev + 1)
  }, [])

  return React.useMemo(
    () => ({
      result,
      refetch,
    }),
    [result, refetch],
  )
}

export const use = useRequest
