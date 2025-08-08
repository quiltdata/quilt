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

export interface Dates {
  gte: Date | null
  lte: Date | null
}

interface DatesStr {
  gte: string
  lte: string
}

function parseDates(dates: DatesStr): Dates | Error {
  const gte = ymdToDate(dates.gte)
  if (gte instanceof Error) return gte
  const lte = ymdToDate(dates.lte)
  if (lte instanceof Error) return lte
  return { gte, lte }
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
  const initialGte = dateToYmd(value.gte || extents.min)
  const initialLte = dateToYmd(value.lte || extents.max)
  const [gte, setGte] = React.useState(initialGte)
  const [lte, setLte] = React.useState(initialLte)
  const handleGte = React.useCallback(
    (event) => {
      setGte(event.target.value)
      onChange(parseDates({ gte: event.target.value, lte }))
    },
    [onChange, lte],
  )
  const handleLte = React.useCallback(
    (event) => {
      setLte(event.target.value)
      onChange(parseDates({ gte, lte: event.target.value }))
    },
    [onChange, gte],
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
        onChange={handleGte}
        value={gte}
      />
      <DateField
        className={classes.input}
        inputProps={inputProps}
        label="To"
        onChange={handleLte}
        value={lte}
      />
      {error && <M.FormHelperText error>{error.message}</M.FormHelperText>}
    </div>
  )
}
