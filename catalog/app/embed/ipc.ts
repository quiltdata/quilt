import * as React from 'react'

import parseSearch from 'utils/parseSearch'

const getParamOr = (param: string | string[] | undefined, fallback: string) =>
  (Array.isArray(param) ? param[0] : param) || fallback

const EVENT_SOURCE = 'quilt-embed'
const search = parseSearch(window.location.search)
const NONCE = getParamOr(search.nonce, `${Math.random}`)
const PARENT_ORIGIN = getParamOr(search.origin, '*')

export function useMessageParent() {
  return React.useCallback((data: object) => {
    window.parent.postMessage(
      { source: EVENT_SOURCE, nonce: NONCE, ...data },
      PARENT_ORIGIN,
    )
  }, [])
}

export function useMessageHandler(fn: (data: object) => void) {
  const handleMessage = React.useCallback(
    (e: MessageEvent) => {
      if (
        e.source !== window.parent ||
        (PARENT_ORIGIN !== '*' && e.origin !== PARENT_ORIGIN) ||
        !e.data?.type
      )
        return
      fn(e.data)
    },
    [fn],
  )

  React.useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [handleMessage])
}
