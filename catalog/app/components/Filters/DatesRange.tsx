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

interface DatesStr {
  min: string
  max: string
}

function parseDates(dates: DatesStr): Dates | Error {
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
  error: Error | null
  extents: { min: Date; max: Date }
  onChange: (v: Value<Dates>) => void
  value: Dates
}

export default function DatesRange({ error, extents, onChange, value }: DateRangeProps) {
  const classes = useStyles()
  const from = value.min || extents.min
  const to = value.max || extents.max
  const [min, setMin] = React.useState(from ? dateToYmd(from) : from)
  const [max, setMax] = React.useState(to ? dateToYmd(to) : to)
  const handleMin = React.useCallback(
    (event) => {
      setMin(event.target.value)
      onChange(parseDates({ min: event.target.value, max }))
    },
    [onChange, max],
  )
  const handleMax = React.useCallback(
    (event) => {
      setMax(event.target.value)
      onChange(parseDates({ min, max: event.target.value }))
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
        onChange={handleMin}
        value={min}
      />
      <DateField
        className={classes.input}
        inputProps={inputProps}
        label="To"
        onChange={handleMax}
        value={max}
      />
      {error && <M.FormHelperText error>{error.message}</M.FormHelperText>}
    </div>
  )
}
