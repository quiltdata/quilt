import * as React from 'react'

/**
 * Fire callback synchronously with previous value and memoize current value
 */
export default function usePreviousSync(value, callback) {
  const ref = React.useRef()

  if (callback) callback(ref.current)

  ref.current = value
  return ref.current
}
