import isEqual from 'lodash/isEqual'
import * as React from 'react'

interface Ref<I, V> {
  input?: I
  value?: V
  get?: () => V
}

export default <I, V>(
  input: I,
  cons: (input: I) => V,
  eq: (a: I | undefined, b: I) => boolean = isEqual,
): (() => V) => {
  const ref = React.useRef<Ref<I, V>>({})
  if (!eq(ref.current && ref.current.input, input)) {
    delete ref.current.value
    delete ref.current.get
  }
  if (!ref.current.get) {
    ref.current.get = function get() {
      if (!('value' in ref.current)) {
        ref.current.value = cons(input)
      }
      return ref.current.value as V
    }
  }
  ref.current = { ...ref.current, input }
  // `get` is guaranteed set by the block above; the Ref type keeps it optional.
  return ref.current.get as () => V
}
