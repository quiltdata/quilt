import * as IO from 'io-ts'
import * as React from 'react'
import * as M from '@material-ui/core'

import Log from 'utils/Logging'
import { formatQuantity } from 'utils/string'

import * as RangeField from './RangeField'
import Slider from './Slider'

function parse(str: string): RangeField.InputState<number> {
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

type NumberFieldProps = Omit<RangeField.Props<number>, 'parse' | 'stringify'>

export const NumberField = (props: NumberFieldProps) => (
  <RangeField.Field stringify={stringify} parse={parse} {...props} />
)

const formatLabel = (number: number) =>
  formatQuantity(number, { fallback: (n: number) => Math.round(n * 100) / 100 })

const useStyles = M.makeStyles((t) => {
  const gap = t.spacing(1)
  return {
    inputs: {
      display: 'grid',
      gridTemplateColumns: `calc(50% - ${gap / 2}px) calc(50% - ${gap / 2}px)`,
      columnGap: gap,
    },
    slider: {
      padding: t.spacing(0, 1),
    },
  }
})

type Range<Parsed> = { gte: Parsed | null; lte: Parsed | null }

type Extents<Parsed> = { min?: Parsed; max?: Parsed }

function alignRange<T>({ gte, lte }: Range<T>): Range<T> {
  return gte != null && lte != null && gte > lte ? { gte: lte, lte: gte } : { gte, lte }
}

interface NumbersRangeProps<Parsed> {
  extents: Extents<Parsed>
  onChange: (v: Range<Parsed>) => void
  value: Range<Parsed>
}

export default function NumbersRange({
  extents,
  value,
  onChange,
}: NumbersRangeProps<number>) {
  const classes = useStyles()

  const { min, max } = extents
  const left = value.gte ?? min ?? null
  const right = value.lte ?? max ?? null

  const handleGte = React.useCallback(
    (gte: number | null) => onChange(alignRange({ gte, lte: right })),
    [onChange, right],
  )
  const handleLte = React.useCallback(
    (lte: number | null) => onChange(alignRange({ gte: left, lte })),
    [onChange, left],
  )

  return (
    <div>
      {min != null && max != null && min !== max && (
        <Slider
          className={classes.slider}
          convert={IO.identity}
          formatLabel={formatLabel}
          max={max}
          min={min}
          onChange={onChange}
          value={value}
        />
      )}
      <div className={classes.inputs}>
        <NumberField onChange={handleGte} value={left} extents={extents} label="From" />
        <NumberField onChange={handleLte} value={right} extents={extents} label="To" />
      </div>
    </div>
  )
}
