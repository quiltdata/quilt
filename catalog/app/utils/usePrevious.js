import * as React from 'react'

export default function usePrevious(value, onChange) {
  const ref = React.useRef()
  const prev = ref.current
  ref.current = value
  React.useEffect(() => {
    if (onChange) onChange(prev)
  })
  return prev
}
