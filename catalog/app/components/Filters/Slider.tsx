import * as d3Scale from 'd3-scale'
import * as React from 'react'
import * as M from '@material-ui/core'

import Log from 'utils/Logging'

const MAX_TICKS = 100
const SCALE_CURVE = 2
const ROUNDING_THRESHOLD = 100

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

type NumberLike = number | { valueOf(): number }

function convertDomainToValues<V>(scale: Scale, convert: (v: number) => V) {
  return ([gte, lte]: [number, number]) => ({
    gte: convert(roundAboveThreshold(scale(gte))),
    lte: convert(roundAboveThreshold(scale(lte))),
  })
}

const convertValuesToDomain =
  (scale: Scale) =>
  ({ gte, lte }: { gte: NumberLike | null; lte: NumberLike | null }) => [
    gte != null ? scale.invert(gte) : 0,
    lte != null ? scale.invert(lte) : 100,
  ]

const roundAboveThreshold = (n: number) => (n > ROUNDING_THRESHOLD ? Math.round(n) : n)

const useSliderStyles = M.makeStyles((t) => ({
  mark: {
    opacity: t.palette.action.disabledOpacity,
  },
}))

interface SliderProps<Value extends NumberLike> {
  className?: string
  convert: (v: number) => Value
  formatLabel: (number: number) => React.ReactNode
  max: Value
  min: Value
  onChange: (v: { gte: Value; lte: Value }) => void
  value: { gte: Value | null; lte: Value | null }
}

export default function Slider<Value extends NumberLike>({
  className,
  convert,
  min,
  max,
  onChange,
  value,
  formatLabel,
}: SliderProps<Value>) {
  const classes = useSliderStyles()
  const { marks, scale } = useScale(min.valueOf(), max.valueOf())
  const handleSlider = React.useCallback(
    (_event, range: number | number[]) => {
      if (!Array.isArray(range)) {
        Log.error(
          `Expected an array of numbers for range, but received: ${JSON.stringify(range)} (type: ${typeof range})`,
        )
        return
      }
      const [left, right] = range
      onChange(convertDomainToValues(scale, convert)([left, right]))
    },
    [convert, onChange, scale],
  )
  const sliderValue = React.useMemo(
    () => convertValuesToDomain(scale)(value),
    [scale, value],
  )
  const valueLabelFormat = React.useCallback(
    (number: number) => formatLabel(roundAboveThreshold(scale(number))),
    [formatLabel, scale],
  )
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
