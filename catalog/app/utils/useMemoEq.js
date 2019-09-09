import isEqual from 'lodash/isEqual'
import * as React from 'react'

export default (input, cons, eq = isEqual) => {
  const ref = React.useRef(null)
  if (eq(ref.current && ref.current.input, input)) {
    return ref.current.value
  }
  const value = cons(input)
  ref.current = { input, value }
  return value
}
