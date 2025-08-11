import * as dateFns from 'date-fns'
import * as React from 'react'
import * as M from '@material-ui/core'

import Log from 'utils/Logging'

import * as RangeField from './RangeField'

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

const useStyles = M.makeStyles((t) => {
  const gap = t.spacing(1)
  return {
    root: {
      display: 'grid',
      gridTemplateColumns: `calc(50% - ${gap / 2}px) calc(50% - ${gap / 2}px)`,
      columnGap: gap,
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
  const left = value.gte || extents.min || null
  const right = value.lte || extents.max || null
  const handleGte = React.useCallback(
    (gte: Date | null) => onChange({ gte, lte: right }),
    [right, onChange],
  )
  const handleLte = React.useCallback(
    (lte: Date | null) => onChange({ gte: left, lte }),
    [left, onChange],
  )
  return (
    <div className={classes.root}>
      <DateField value={left} extents={extents} onChange={handleGte} label="From" />
      <DateField value={right} extents={extents} onChange={handleLte} label="To" />
    </div>
  )
}
