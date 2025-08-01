import * as React from 'react'

import List from './List'
import type { Value } from './types'

const KEYS = ['true', 'false'] as const

type Key = (typeof KEYS)[number]

type BooleanFilterValue = {
  [key in Key]: boolean
}

interface BooleanFilterProps {
  className?: string
  value: BooleanFilterValue
  onChange: (v: Value<BooleanFilterValue>) => void
}

export default function BooleanFilter({
  className,
  value,
  onChange,
}: BooleanFilterProps) {
  const handleChange = React.useCallback(
    (bools: Value<string[]>) => {
      if (bools instanceof Error) {
        onChange(bools)
        return
      }
      if (bools.some((b) => b !== 'true' && b !== 'false')) {
        onChange(new Error(`Value ${bools} out of bounds`))
        return
      }
      onChange({
        true: bools.includes('true'),
        false: bools.includes('false'),
      })
    },
    [onChange],
  )
  const bools = React.useMemo(() => {
    let output = []
    if (value.true) {
      output.push('true')
    }
    if (value.false) {
      output.push('false')
    }
    return output
  }, [value])
  return (
    <List className={className} extents={KEYS} onChange={handleChange} value={bools} />
  )
}
