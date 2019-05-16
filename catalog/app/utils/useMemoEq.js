import * as R from 'ramda'
import * as React from 'react'

export default (input, cons, eq = R.equals) => {
  const ref = React.useRef(null)
  if (eq(ref.current && ref.current.input, input)) {
    return ref.current.value
  }
  const value = cons(input)
  ref.current = { input, value }
  return value
}
