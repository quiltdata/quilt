import * as dateFns from 'date-fns'
import * as React from 'react'
import * as M from '@material-ui/core'

import type { Value } from './types'

// TODO: dateFns.parseISO?
const ymdToDate = (ymd: string): Date | Error => {
  const date = new Date(ymd)
  if (Number.isNaN(date.valueOf())) {
    return new Error('Invalid date')
  }
  return date
}

const dateToYmd = (date: Date): string => dateFns.format(date, 'yyyy-MM-dd')

function DateField(props: M.TextFieldProps) {
  return (
    <M.TextField
      size="small"
      type="date"
      variant="outlined"
      InputLabelProps={{ shrink: true }}
      {...props}
    />
  )
}

interface Dates {
  min: Date | null
  max: Date | null
}

function validate(dates: { min: string; max: string }): Dates | Error {
  const min = ymdToDate(dates.min)
  if (min instanceof Error) return min
  const max = ymdToDate(dates.max)
  if (max instanceof Error) return max
  return { min, max }
}

const useStyles = M.makeStyles((t) => {
  const gap = t.spacing(1)
  return {
    root: {
      display: 'grid',
      gridTemplateColumns: `calc(50% - ${gap / 2}px) calc(50% - ${gap / 2}px)`,
      columnGap: gap,
    },
    input: {
      background: t.palette.background.paper,
    },
  }
})

interface DateRangeProps {
  extents: { min: Date; max: Date }
  onChange: (v: Value<{ min: Date | null; max: Date | null }>) => void
  value: { min: Date | null; max: Date | null }
}

export default function DatesRange({ extents, value, onChange }: DateRangeProps) {
  const classes = useStyles()
  const from = value.min || extents.min
  const to = value.max || extents.max
  const [min, setMin] = React.useState(from ? dateToYmd(from) : from)
  const [max, setMax] = React.useState(to ? dateToYmd(to) : to)
  const [error, setError] = React.useState<Error | null>(null)
  const handleFrom = React.useCallback(
    (event) => {
      setMin(event.target.value)
      setError(null)

      const dates = validate({ min: event.target.value, max })
      onChange(dates)
      if (dates instanceof Error) {
        setError(dates)
      }
    },
    [onChange, max],
  )
  const handleTo = React.useCallback(
    (event) => {
      setMax(event.target.value)
      setError(null)

      const dates = validate({ min, max: event.target.value })
      onChange(dates)
      if (dates instanceof Error) {
        setError(dates)
      }
    },
    [onChange, min],
  )
  const inputProps = React.useMemo(
    () => ({
      min: dateToYmd(extents.min),
      max: dateToYmd(extents.max),
    }),
    [extents],
  )
  return (
    <div className={classes.root}>
      <DateField
        className={classes.input}
        inputProps={inputProps}
        label="From "
        onChange={handleFrom}
        value={min}
      />
      <DateField
        className={classes.input}
        inputProps={inputProps}
        label="To"
        onChange={handleTo}
        value={max}
      />
      {error && <M.FormHelperText error>{error.message}</M.FormHelperText>}
    </div>
  )
}
