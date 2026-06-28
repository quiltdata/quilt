import * as React from 'react'

export interface Mutex<T = string> {
  current: T | null
  claim: React.Dispatch<React.SetStateAction<T | null>>
  release: (id: T) => void
}

export default function useMutex<T = string>(init: T | null = null): Mutex<T> {
  const [current, claim] = React.useState<T | null>(init)
  const release = React.useCallback(
    (id: T) => claim((cur) => (id === cur ? null : cur)),
    [claim],
  )
  return React.useMemo(() => ({ current, claim, release }), [current, claim, release])
}
