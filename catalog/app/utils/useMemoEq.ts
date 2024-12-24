import * as R from 'ramda'
import * as React from 'react'

export default function useMemoEq<I, O>(
  input: I,
  cons: (input: I) => O,
  eq: (a: I, b: I) => boolean = R.equals,
) {
  const ref = React.useRef<{ input: I; value: O }>()
  if (ref.current && eq(ref.current.input, input)) {
    return ref.current.value
  }
  const value = cons(input)
  ref.current = { input, value }
  return value
}
