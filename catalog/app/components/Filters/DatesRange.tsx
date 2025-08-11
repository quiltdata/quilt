import * as dateFns from 'date-fns'
import * as React from 'react'
import * as M from '@material-ui/core'

import Log from 'utils/Logging'

import * as RangeField from './RangeField'
import Slider from './Slider'
import type { Scale } from './Slider'

const InputLabelProps = { shrink: true }

function fromYmd(ymd: string): RangeField.InputState<string, Date> {
  const date = dateFns.parseISO(ymd)
  return dateFns.isValid(date)
    ? RangeField.Ok(ymd, date)
    : RangeField.Err(ymd, new Error(date.toString()))
}

function fromDate(date?: Date | null): RangeField.InputState<string, Date> {
  if (!date) return RangeField.Err('', new Error('Empty date'))
  try {
    return RangeField.Ok(dateFns.format(date, 'yyyy-MM-dd'), date)
  } catch (e) {
    Log.error(e)
    return RangeField.Err('', e)
  }
}

type DateFieldProps = Omit<RangeField.Props<Date>, 'fromValue' | 'toValue'>

export const DateField = (props: DateFieldProps) => (
  <RangeField.Field
    InputLabelProps={InputLabelProps}
    fromValue={fromDate}
    toValue={fromYmd}
    {...props}
  />
)

const ROUNDING_THRESHOLD = 100

const roundAboveThreshold = (n: number) => (n > ROUNDING_THRESHOLD ? Math.round(n) : n)

const createValueLabelFormat = (scale: Scale) => (number: number) => {
  const scaled = scale(number)
  return dateFns.intlFormat(new Date(roundAboveThreshold(scaled)))
}

const convertValuesToDomain =
  (scale: Scale) =>
  ({ gte, lte }: { gte: Date | null; lte: Date | null }) => [
    gte != null ? scale.invert(gte) : 0,
    lte != null ? scale.invert(lte) : 100,
  ]

const convertDomainToValues =
  (scale: Scale) =>
  ([gte, lte]: [number, number]) => ({
    gte: new Date(roundAboveThreshold(scale(gte))),
    lte: new Date(roundAboveThreshold(scale(lte))),
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

interface DateRangeProps<Value = { gte: Date | null; lte: Date | null }> {
  extents: { min?: Date; max?: Date }
  onChange: (v: Value) => void
  value: Value
}

export default function DatesRange({ extents, value, onChange }: DateRangeProps) {
  const classes = useStyles()
  const { min, max } = extents
  const left = value.gte || min || null
  const right = value.lte || max || null
  const handleGte = React.useCallback(
    (gte: Date | null) => {
      if (gte != null && right != null && gte > right) {
        onChange({ gte: right, lte: gte })
      } else {
        onChange({ gte, lte: right })
      }
    },
    [right, onChange],
  )
  const handleLte = React.useCallback(
    (lte: Date | null) => {
      if (lte != null && left != null && left > lte) {
        onChange({ gte: lte, lte: left })
      } else {
        onChange({ gte: left, lte })
      }
    },
    [left, onChange],
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
        <DateField
          extents={extents}
          label="From"
          onChange={handleGte}
          type="date"
          value={left}
        />
        <DateField
          extents={extents}
          label="To"
          onChange={handleLte}
          type="date"
          value={right}
        />
      </div>
    </div>
  )
}
