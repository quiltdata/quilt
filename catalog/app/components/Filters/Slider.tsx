import * as d3Scale from 'd3-scale'
import * as React from 'react'
import * as M from '@material-ui/core'

import Log from 'utils/Logging'

const MAX_TICKS = 100
const SCALE_CURVE = 2

function ValueLabelComponent({ children, open, value }: M.ValueLabelProps) {
  return (
    <M.Tooltip open={open} enterTouchDelay={0} title={value} placement="top">
      {children}
    </M.Tooltip>
  )
}

export type Scale = d3Scale.ScaleContinuousNumeric<number, number>

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

const useSliderStyles = M.makeStyles((t) => ({
  mark: {
    opacity: t.palette.action.disabledOpacity,
  },
}))

type NumberLike = number | { valueOf: () => number }

interface SliderProps<Value> {
  className?: string
  createValueLabelFormat: (scale: Scale) => (number: number) => React.ReactNode
  fromValues: (
    scale: Scale,
  ) => ({ gte, lte }: { gte: Value | null; lte: Value | null }) => number[]
  max: Value
  min: Value
  onChange: (v: { gte: Value; lte: Value }) => void
  toValues: (scale: Scale) => ([gte, lte]: [number, number]) => { gte: Value; lte: Value }
  value: { gte: Value | null; lte: Value | null }
}

export default function Slider<Value extends NumberLike>({
  className,
  min,
  max,
  onChange,
  value,
  toValues,
  createValueLabelFormat,
  fromValues,
}: SliderProps<Value>) {
  const classes = useSliderStyles()
  const { marks, scale } = useScale(min.valueOf(), max.valueOf())
  const handleSlider = React.useCallback(
    (_event, range: number | number[]) => {
      if (!Array.isArray(range)) {
        Log.error('Not a range of numbers')
        return
      }
      const [left, right] = range
      onChange(toValues(scale)([left, right]))
    },
    [onChange, scale, toValues],
  )
  const sliderValue = React.useMemo(
    () => fromValues(scale)(value),
    [fromValues, scale, value],
  )
  const valueLabelFormat = React.useMemo(
    () => createValueLabelFormat(scale),
    [createValueLabelFormat, scale],
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
