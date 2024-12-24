import * as React from 'react'
import { useDebounce } from 'use-debounce'

import usePrevious from 'utils/usePrevious'

export interface DebouncedInput<V> {
  input: {
    value: V
    onChange: (e: { target: { value: V } }) => void
  }
  value: V
  set: (v: V) => void
}

export function useDebouncedInput<V = unknown>(
  init: V,
  timeout: number = 500,
): DebouncedInput<V> {
  const [value, setValue] = React.useState(init)
  const [debouncedValue] = useDebounce(value, timeout)

  usePrevious(init, (prevInit) => {
    if (init !== prevInit) setValue(init)
  })

  const onChange = React.useCallback(
    (e: { target: { value: V } }) => {
      setValue(e.target.value)
    },
    [setValue],
  )

  return {
    input: { value, onChange },
    value: debouncedValue,
    set: setValue,
  }
}

export default useDebouncedInput
