import * as React from 'react'
import * as M from '@material-ui/core'
import * as d3Scale from 'd3-scale'

import { formatQuantity } from 'utils/string'

import type { Value } from './types'

export interface Numbers {
  gte: number | null
  lte: number | null
}

interface NumbersStr {
  gte: string
  lte: string
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

const convertValuesToDomain = (scale: Scale, { gte, lte }: Numbers) => [
  gte != null ? scale.invert(gte) : 0,
  lte != null ? scale.invert(lte) : 100,
]

const convertDomainToValues =
  (scale: Scale) =>
  ([gte, lte]: [number, number]) => ({
    gte: roundAboveThreshold(scale(gte)),
    lte: roundAboveThreshold(scale(lte)),
  })

function parseNumbersOr<T>(value: NumbersStr, fallback: T): Numbers | T {
  const gte = Number(value.gte)
  if (!isNumber(gte)) return fallback
  const lte = Number(value.lte)
  if (!isNumber(lte)) return fallback
  return { gte, lte }
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
  const [gte, setGte] = React.useState((initialValue.gte || extents.min).toString())
  const [lte, setLte] = React.useState((initialValue.lte || extents.max).toString())

  React.useEffect(
    () => setGte((initialValue.gte || extents.min).toString()),
    [initialValue.gte, extents.min],
  )
  React.useEffect(
    () => setLte((initialValue.lte || extents.max).toString()),
    [initialValue.lte, extents.max],
  )

  const handleSlider = React.useCallback(
    (_event, sliderValues) => {
      const values = convertDomainToValues(scale)(sliderValues)
      setGte(values.gte.toString())
      setLte(values.lte.toString())
      onChange(values)
    },
    [onChange, scale],
  )
  const sliderValue = React.useMemo(
    () =>
      convertValuesToDomain(
        scale,
        parseNumbersOr({ gte, lte }, { gte: null, lte: null }),
      ),
    [gte, lte, scale],
  )
  const handleMin = React.useCallback(
    (event) => {
      setGte(event.target.value)
      onChange(parseNumbersOr({ gte: event.target.value, lte }, NaNError))
    },
    [onChange, lte],
  )
  const handleMax = React.useCallback(
    (event) => {
      setLte(event.target.value)
      onChange(parseNumbersOr({ gte, lte: event.target.value }, NaNError))
    },
    [onChange, gte],
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
          value={gte}
          variant="outlined"
        />
        <M.TextField
          className={classes.input}
          label="To"
          onChange={handleMax}
          size="small"
          value={lte}
          variant="outlined"
        />
      </div>
      {error && <M.FormHelperText error>{error.message}</M.FormHelperText>}
    </div>
  )
}
