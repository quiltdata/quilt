import * as React from 'react'

export default function useConstant<T>(cons: () => T) {
  const ref = React.useRef<T | null>(null)
  if (!ref.current) {
    ref.current = cons()
  }
  return ref.current
}
