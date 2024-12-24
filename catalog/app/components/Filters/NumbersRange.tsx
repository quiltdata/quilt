import * as React from 'react'
import * as M from '@material-ui/core'
import * as d3Scale from 'd3-scale'

import * as Notifications from 'containers/Notifications'
import { formatQuantity } from 'utils/string'

const MAX_TICKS = 100
const SCALE_CURVE = 2
const ROUNDING_THRESHOLD = 100

const roundAboveThreshold = (n: number) => (n > ROUNDING_THRESHOLD ? Math.round(n) : n)

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

interface NumbersRangeProps {
  extents: { min: number; max: number }
  onChange: (v: { min: number | null; max: number | null }) => void
  value: { min: number | null; max: number | null }
}

export default function NumbersRange({ extents, value, onChange }: NumbersRangeProps) {
  const { marks, scale } = useScale(extents.min, extents.max)
  const [invalidId, setInvalidId] = React.useState('')
  const { push: notify, dismiss } = Notifications.use()
  const classes = useStyles()
  const validate = React.useCallback(
    (v) => {
      if (invalidId) {
        setInvalidId('')
        dismiss(invalidId)
      }

      if (!isNumber(v)) {
        const {
          notification: { id },
        } = notify('Enter valid number, please')
        setInvalidId(id)
      }
    },
    [dismiss, invalidId, notify],
  )
  // XXX: it would be nice to debounce high-frequency URL changes, but it's not that trivial
  const handleSlider = React.useCallback(
    (_event, [min, max]) => onChange(convertDomainToValues(scale)([min, max])),
    [onChange, scale],
  )

  const min = value.min || extents.min
  const max = value.max || extents.max
  const handleFrom = React.useCallback(
    (event) => {
      const newMin = Number(event.target.value)
      if (isNumber(newMin)) {
        onChange({ min: newMin, max })
      }
      validate(newMin)
    },
    [onChange, max, validate],
  )
  const handleTo = React.useCallback(
    (event) => {
      const newMax = Number(event.target.value)
      if (isNumber(newMax)) {
        onChange({ min, max: newMax })
      }
      validate(newMax)
    },
    [onChange, min, validate],
  )
  const sliderValue = React.useMemo(
    () => convertValuesToDomain(scale)(value),
    [value, scale],
  )
  const valueLabelFormat = React.useMemo(() => createValueLabelFormat(scale), [scale])
  return (
    <div>
      <div className={classes.slider}>
        <M.Slider
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
    </div>
  )
}
