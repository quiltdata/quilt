import * as React from 'react'

/**
 * Fire onChange callback with previous value and memoize current value
 * TODO: explain why `useEffect`
 */
export default (value, onChange) => {
  const ref = React.useRef()
  React.useEffect(() => {
    if (onChange) onChange(ref.current)
    ref.current = value
  })
  return ref.current
}
