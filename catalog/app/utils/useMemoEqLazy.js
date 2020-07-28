import isEqual from 'lodash/isEqual'
import * as React from 'react'

export default (input, cons, eq = isEqual) => {
  const ref = React.useRef({})
  if (!eq(ref.current && ref.current.input, input)) {
    delete ref.current.value
    delete ref.current.get
  }
  if (!ref.current.get) {
    ref.current.get = function get() {
      if (!('value' in ref.current)) {
        ref.current.value = cons(input)
      }
      return ref.current.value
    }
  }
  ref.current = { ...ref.current, input }
  return ref.current.get
}
