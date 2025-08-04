import * as React from 'react'
import * as M from '@material-ui/core'
import * as d3Scale from 'd3-scale'

import { formatQuantity } from 'utils/string'

import type { Value } from './types'

interface Numbers {
  min: number | null
  max: number | null
}

interface NumbersStr {
  min: string
  max: string
}

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

const isNumber = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v)

const NaNError = new Error('Enter valid number, please')

const convertValuesToDomain = (scale: Scale, { min, max }: Numbers) => [
  min != null ? scale.invert(min) : 0,
  max != null ? scale.invert(max) : 100,
]

const convertDomainToValues =
  (scale: Scale) =>
  ([min, max]: [number, number]) => ({
    min: roundAboveThreshold(scale(min)),
    max: roundAboveThreshold(scale(max)),
  })

function parseNumbersOr<T>(value: NumbersStr, fallback: T): Numbers | T {
  const min = Number(value.min)
  if (!isNumber(min)) return fallback
  const max = Number(value.max)
  if (!isNumber(max)) return fallback
  return { min, max }
}

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
  onChange: (v: Value<Numbers>) => void
  initialValue: Numbers
  error: Error | null
}

// 1. It is possible to type letters in input field.
// 2. It doesn't make sense to return strings (not numbers) in `onChange`.
// 3. So,
//    * we store valid state outside of the component,
//    * and intermitent state inside the component.
// That's why it has `initialValue` and not a `value`

export default function NumbersRange({
  error,
  extents,
  initialValue,
  onChange,
}: NumbersRangeProps) {
  const classes = useStyles()
  const sliderClasses = useSliderStyles()

  const { marks, scale } = useScale(extents.min, extents.max)
  const [min, setMin] = React.useState((initialValue.min || extents.min).toString())
  const [max, setMax] = React.useState((initialValue.max || extents.max).toString())

  React.useEffect(
    () => setMin((initialValue.min || extents.min).toString()),
    [initialValue.min, extents.min],
  )
  React.useEffect(
    () => setMax((initialValue.max || extents.max).toString()),
    [initialValue.max, extents.max],
  )

  const handleSlider = React.useCallback(
    (_event, sliderValues) => {
      const values = convertDomainToValues(scale)(sliderValues)
      setMin(values.min.toString())
      setMax(values.max.toString())
      onChange(values)
    },
    [onChange, scale],
  )
  const sliderValue = React.useMemo(
    () =>
      convertValuesToDomain(
        scale,
        parseNumbersOr({ min, max }, { min: null, max: null }),
      ),
    [min, max, scale],
  )
  const handleMin = React.useCallback(
    (event) => {
      setMin(event.target.value)
      onChange(parseNumbersOr({ min: event.target.value, max }, NaNError))
    },
    [onChange, max],
  )
  const handleMax = React.useCallback(
    (event) => {
      setMax(event.target.value)
      onChange(parseNumbersOr({ min, max: event.target.value }, NaNError))
    },
    [onChange, min],
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
          onChange={handleMin}
          size="small"
          value={min}
          variant="outlined"
        />
        <M.TextField
          className={classes.input}
          label="To"
          onChange={handleMax}
          size="small"
          value={max}
          variant="outlined"
        />
      </div>
      {error && <M.FormHelperText error>{error.message}</M.FormHelperText>}
    </div>
  )
}
