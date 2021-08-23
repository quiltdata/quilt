import * as React from 'react'

export default function usePrevious<V = unknown>(
  value: V,
  onChange?: (prev: V | undefined) => void,
): V | undefined {
  const ref = React.useRef<V>()
  const prev = ref.current
  ref.current = value
  React.useEffect(() => {
    if (onChange) onChange(prev)
  })
  return prev
}
