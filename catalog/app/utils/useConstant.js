import * as React from 'react'

export default function useConstant(cons) {
  const ref = React.useRef()
  if (!ref.current) {
    ref.current = cons()
  }
  return ref.current
}
