import * as React from 'react'
import * as M from '@material-ui/core'
import * as d3Scale from 'd3-scale'

import { formatQuantity } from 'utils/string'

import type { Value } from './types'

const MAX_TICKS = 100
const SCALE_CURVE = 2
const ROUNDING_THRESHOLD = 100

const roundAboveThreshold = (n: number) => (n > ROUNDING_THRESHOLD ? Math.round(n) : n)

type Scale = d3Scale.ScaleContinuousNumeric<number, number>

function ValueLabelComponent({ children, open, value }: M.ValueLabelProps) {
  return (
    <M.Tooltip open={open} enterTouchDelay={0} title={value}>
      {children}
    </M.Tooltip>
  )
}

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

const isNumber = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v)

const useStyles = M.makeStyles((t) => {
  const gap = t.spacing(1)
  return {
    input: {
      background: t.palette.background.paper,
    },
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

const useSliderStyles = M.makeStyles(() => ({
  mark: {
    opacity: 0.38,
  },
}))

interface NumbersRangeProps {
  extents: { min: number; max: number }
  onChange: (v: Value<{ min: number | null; max: number | null }>) => void
  value: { min: number | null; max: number | null }
}

export default function NumbersRange({ extents, value, onChange }: NumbersRangeProps) {
  const { marks, scale } = useScale(extents.min, extents.max)
  const classes = useStyles()
  const sliderClasses = useSliderStyles()
  const handleSlider = React.useCallback(
    (_event, sliderValues) => {
      const { min, max } = convertDomainToValues(scale)(sliderValues)
      setMin(min)
      setMax(max)
      onChange({ min, max })
    },
    [onChange, scale],
  )

  const [error, setError] = React.useState<Error | null>(null)
  const [min, setMin] = React.useState(value.min || extents.min)
  const [max, setMax] = React.useState(value.max || extents.max)

  const handleFrom = React.useCallback(
    (event) => {
      setMin(event.target.value)

      const newMin = Number(event.target.value)
      const invalid = isNumber(newMin) ? null : new Error('Enter valid number, please')
      onChange(invalid ?? { min: newMin, max })
      setError(invalid)
    },
    [onChange, max],
  )
  const handleTo = React.useCallback(
    (event) => {
      setMax(event.target.value)

      const newMax = Number(event.target.value)
      const invalid = isNumber(newMax) ? null : new Error('Enter valid number, please')
      onChange(invalid ?? { min, max: newMax })
      setError(invalid)
    },
    [onChange, min],
  )
  const sliderValue = React.useMemo(
    () => convertValuesToDomain(scale)({ min, max }),
    [min, max, scale],
  )
  const valueLabelFormat = React.useMemo(() => createValueLabelFormat(scale), [scale])
  return (
    <div>
      <div className={classes.slider}>
        <M.Slider
          ValueLabelComponent={ValueLabelComponent}
          classes={sliderClasses}
          marks={marks}
          onChange={handleSlider}
          value={sliderValue}
          valueLabelFormat={valueLabelFormat}
          valueLabelDisplay="auto"
        />
      </div>
      <div className={classes.inputs}>
        <M.TextField
          className={classes.input}
          label="From"
          onChange={handleFrom}
          size="small"
          value={min}
          variant="outlined"
        />
        <M.TextField
          className={classes.input}
          label="To"
          onChange={handleTo}
          size="small"
          value={max}
          variant="outlined"
        />
      </div>
      {error && <M.FormHelperText error>{error.message}</M.FormHelperText>}
    </div>
  )
}
