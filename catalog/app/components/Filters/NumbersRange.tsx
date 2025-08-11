import * as React from 'react'
import * as M from '@material-ui/core'
import * as d3Scale from 'd3-scale'

import Log from 'utils/Logging'
import { formatQuantity } from 'utils/string'

import * as RangeField from './RangeField'

function fromString(str: string): RangeField.InputState<string, number> {
  const num = Number(str)
  return typeof num !== 'number' || Number.isNaN(num)
    ? RangeField.Err(str, new Error('Not a number'))
    : RangeField.Ok(str, num)
}

function fromNumber(num?: number | null): RangeField.InputState<string, number> {
  if (num == null) return RangeField.Err('', new Error('Enter number, please'))
  if (typeof num !== 'number' || Number.isNaN(num)) {
    const error = new Error('Not a number')
    Log.error(error)
    return RangeField.Err('', error)
  }
  return RangeField.Ok(num.toString(), num)
}

type NumberFieldProps = Omit<RangeField.Props<number>, 'fromValue' | 'toValue'>

export const NumberField = (props: NumberFieldProps) => (
  <RangeField.Field fromValue={fromNumber} toValue={fromString} {...props} />
)

const MAX_TICKS = 100
const SCALE_CURVE = 2
const ROUNDING_THRESHOLD = 100

const roundAboveThreshold = (n: number) => (n > ROUNDING_THRESHOLD ? Math.round(n) : n)

function ValueLabelComponent({ children, open, value }: M.ValueLabelProps) {
  return (
    <M.Tooltip open={open} enterTouchDelay={0} title={value} placement="top">
      {children}
    </M.Tooltip>
  )
}

type Scale = d3Scale.ScaleContinuousNumeric<number, number>

function useScale(min: number, max: number) {
  const range = Math.min(Math.ceil(max - min), MAX_TICKS)

  const scale: Scale = React.useMemo(() => {
    let s =
      max - min > MAX_TICKS
        ? d3Scale.scalePow().exponent(SCALE_CURVE)
        : d3Scale.scaleLinear()
    return s.domain([0, range]).range([min, max]).nice()
  }, [min, max, range])

  const marks: M.Mark[] = React.useMemo(
    () => scale.ticks(range + 1).map((value) => ({ value })),
    [scale, range],
  )

  return { marks, scale }
}

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

const useSliderStyles = M.makeStyles((t) => ({
  mark: {
    opacity: t.palette.action.disabledOpacity,
  },
}))

interface SliderProps {
  className?: string
  min: number
  max: number
  onChange: (v: { gte: number; lte: number }) => void
  value: { gte: number | null; lte: number | null }
}

function Slider({ className, min, max, onChange, value }: SliderProps) {
  const classes = useSliderStyles()
  const { marks, scale } = useScale(min, max)
  const handleSlider = React.useCallback(
    (_event, range: number | number[]) => {
      if (!Array.isArray(range)) {
        Log.error('Not a range of numbers')
        return
      }
      const [left, right] = range
      onChange(convertDomainToValues(scale)([left, right]))
    },
    [onChange, scale],
  )
  const sliderValue = React.useMemo(
    () => convertValuesToDomain(scale)(value),
    [value, scale],
  )
  const valueLabelFormat = React.useMemo(() => createValueLabelFormat(scale), [scale])
  return (
    <div className={className}>
      <M.Slider
        ValueLabelComponent={ValueLabelComponent}
        classes={classes}
        marks={marks}
        onChange={handleSlider}
        value={sliderValue}
        valueLabelDisplay="auto"
        valueLabelFormat={valueLabelFormat}
      />
    </div>
  )
}

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

interface NumbersRangeProps {
  extents: { min?: number; max?: number }
  onChange: (v: { gte: number | null; lte: number | null }) => void
  value: { gte: number | null; lte: number | null }
}

export default function NumbersRange({ extents, value, onChange }: NumbersRangeProps) {
  const classes = useStyles()

  const { min, max } = extents
  const left = value.gte ?? min ?? null
  const right = value.lte ?? max ?? null

  const handleGte = React.useCallback(
    (gte: number | null) => onChange({ gte, lte: right }),
    [onChange, right],
  )
  const handleLte = React.useCallback(
    (lte: number | null) => onChange({ gte: left, lte }),
    [onChange, left],
  )
  return (
    <div>
      {min != null && max != null && min !== max && (
        <Slider
          className={classes.slider}
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
