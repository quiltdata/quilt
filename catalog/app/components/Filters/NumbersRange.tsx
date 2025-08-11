import * as React from 'react'
import * as M from '@material-ui/core'

import Log from 'utils/Logging'
import { formatQuantity } from 'utils/string'

import * as RangeField from './RangeField'
import Slider from './Slider'
import type { Scale } from './Slider'

function fromString(str: string): RangeField.InputState<number> {
  const num = Number(str)
  return Number.isNaN(num)
    ? RangeField.Err(str, new Error('Not a number'))
    : RangeField.Ok(str, num)
}

function fromNumber(num?: number | null): RangeField.InputState<number> {
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
  <RangeField.Field stringify={fromNumber} parse={fromString} {...props} />
)

const ROUNDING_THRESHOLD = 100

const roundAboveThreshold = (n: number) => (n > ROUNDING_THRESHOLD ? Math.round(n) : n)

const createValueLabelFormat = (scale: Scale) => (number: number) => {
  const scaled = scale(number)
  return formatQuantity(roundAboveThreshold(scaled), {
    fallback: (n: number) => Math.round(n * 100) / 100,
  })
}

const convertValuesToDomain =
  (scale: Scale) =>
  ({ gte, lte }: { gte: number | null; lte: number | null }) => [
    gte != null ? scale.invert(gte) : 0,
    lte != null ? scale.invert(lte) : 100,
  ]

const convertDomainToValues =
  (scale: Scale) =>
  ([gte, lte]: [number, number]) => ({
    gte: roundAboveThreshold(scale(gte)),
    lte: roundAboveThreshold(scale(lte)),
  })

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

type Range = { gte: number | null; lte: number | null }

const alignRange = ({ gte, lte }: Range): Range =>
  gte != null && lte != null && gte > lte ? { gte: lte, lte: gte } : { gte, lte }

interface NumbersRangeProps {
  extents: { min?: number; max?: number }
  onChange: (v: Range) => void
  value: Range
}

export default function NumbersRange({ extents, value, onChange }: NumbersRangeProps) {
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
          createValueLabelFormat={createValueLabelFormat}
          fromValues={convertValuesToDomain}
          max={max}
          min={min}
          onChange={onChange}
          toValues={convertDomainToValues}
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
