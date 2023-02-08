import * as React from 'react'

type Callback = (d: number) => void

export default function usePolling(callback: Callback, interval: number) {
  const callbackRef = React.useRef<Callback>()
  callbackRef.current = callback
  React.useEffect(() => {
    const int = setInterval(() => {
      if (callbackRef.current) callbackRef.current(Date.now())
    }, interval * 1000)
    return () => {
      clearInterval(int)
    }
  }, [interval])
}
