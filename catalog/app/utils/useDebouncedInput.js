import * as React from 'react'
import { useDebounce } from 'use-debounce'

import usePrevious from 'utils/usePrevious'

export default function useDebouncedInput(init, timeout = 500) {
  const [value, setValue] = React.useState(init)
  const [debouncedValue] = useDebounce(value, timeout)

  usePrevious(init, (prevInit) => {
    if (init !== prevInit) setValue(init)
  })

  const onChange = React.useCallback(
    (e) => {
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
