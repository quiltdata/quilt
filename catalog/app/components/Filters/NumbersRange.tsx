import * as IO from 'io-ts'
import * as React from 'react'

import Log from 'utils/Logging'
import { formatQuantity } from 'utils/string'

import * as Range from './Range'
import * as RangeField from './RangeField'

function parseString(str: string): RangeField.InputState<number> {
  const num = Number(str)
  return Number.isNaN(num)
    ? RangeField.Err(str, new Error('Not a number'))
    : RangeField.Ok(str, num)
}

function stringify(num?: number | null): RangeField.InputState<number> {
  if (num == null) return RangeField.Err('', new Error('Enter number, please'))
  if (typeof num !== 'number' || Number.isNaN(num)) {
    const error = new Error('Not a number')
    Log.error(error)
    return RangeField.Err('', error)
  }
  return RangeField.Ok(num.toString(), num)
}

const formatLabel = (number: number) =>
  formatQuantity(number, { fallback: (n: number) => Math.round(n * 100) / 100 })

type NumbersRangeProps = Pick<
  Range.FormControlProps<number>,
  'extents' | 'onChange' | 'value'
>

export default function NumbersRange({ extents, value, onChange }: NumbersRangeProps) {
  return (
    <Range.FormControl
      extents={extents}
      formatLabel={formatLabel}
      onChange={onChange}
      parseNumber={IO.identity}
      parseString={parseString}
      stringify={stringify}
      value={value}
    />
  )
}
