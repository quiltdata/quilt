import * as React from 'react'
import * as M from '@material-ui/core'
import * as d3Scale from 'd3-scale'

import Log from 'utils/Logging'
import { formatQuantity } from 'utils/string'

import NumberField from './NumberField'

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
  ({ min, max }: { min: number | null; max: number | null }) => [
    min != null ? scale.invert(min) : 0,
    max != null ? scale.invert(max) : 100,
  ]

const convertDomainToValues =
  (scale: Scale) =>
  ([min, max]: [number, number]) => ({
    min: roundAboveThreshold(scale(min)),
    max: roundAboveThreshold(scale(max)),
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
  onChange: (v: { min: number; max: number }) => void
  value: { min: number | null; max: number | null }
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
      const [gte, lte] = range
      onChange(convertDomainToValues(scale)([gte, lte]))
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
  onChange: (v: { min: number | null; max: number | null }) => void
  value: { min: number | null; max: number | null }
}

export default function NumbersRange({ extents, value, onChange }: NumbersRangeProps) {
  const classes = useStyles()

  const { min, max } = extents
  const left = value.min ?? min ?? null
  const right = value.max ?? max ?? null

  const handleGte = React.useCallback(
    (gte: number | null) => onChange({ min: gte, max: right }),
    [onChange, right],
  )
  const handleLte = React.useCallback(
    (lte: number | null) => onChange({ min: left, max: lte }),
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
