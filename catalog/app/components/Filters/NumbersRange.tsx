import * as React from 'react'
import * as M from '@material-ui/core'
import * as d3Scale from 'd3-scale'

import * as Notifications from 'containers/Notifications'
import { formatQuantity } from 'utils/string'

const isNumber = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v)

type Scale = d3Scale.ScalePower<number, number> | d3Scale.ScaleLinear<number, number>

export function createNonLinearScale({ min, max }: { min: number; max: number }): {
  marks: M.Mark[]
  scale: d3Scale.ScalePower<number, number>
} {
  const scale = d3Scale.scalePow().exponent(10).domain([0, 100]).range([min, max])
  const marks: M.Mark[] = scale
    .ticks(101) // from 0 to 100, including 0
    .map((value) => ({ value }))
  return { marks, scale }
}

export function createLinearScale({ min, max }: { min: number; max: number }): {
  marks: M.Mark[]
  scale: d3Scale.ScaleLinear<number, number>
} {
  const scale = d3Scale.scaleLinear().domain([0, 100]).range([min, max])
  const marks: M.Mark[] = scale
    .ticks(Math.round(max - min + 1))
    .map((value) => ({ value }))
  return { marks, scale }
}

const createValueLabelFormat = (scale: Scale) => (number: number) => {
  const scaled = scale(number)
  return formatQuantity(scaled > 100 ? Math.round(scaled) : scaled, {
    fallback: (n: number) => Math.round(n * 100) / 100,
  })
}

const convertValuesToDomain =
  (scale: Scale) =>
  ({ min, max }: { min: number | null; max: number | null }) => [
    min ? scale.invert(min) : 0,
    max ? scale.invert(max) : 100,
  ]

const convertDomainToValues =
  (scale: Scale) =>
  ([min, max]: [number, number]) => ({
    min: scale(min),
    max: scale(max),
  })

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
  const { marks, scale } = React.useMemo(
    () =>
      extents.max - extents.min > 100
        ? createNonLinearScale(extents)
        : createLinearScale(extents),
    [extents],
  )
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
