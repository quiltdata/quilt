import * as dateFns from 'date-fns'
import * as React from 'react'
import * as M from '@material-ui/core'

const ymdToDate = (ymd: string): Date => new Date(ymd)

const dateToYmd = (date: Date): string => dateFns.format(date, 'yyyy-MM-dd')

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'grid',
    gridTemplateColumns: `calc(50% - ${t.spacing(4) / 2}px) calc(50% - ${
      t.spacing(4) / 2
    }px)`,
    gridColumnGap: t.spacing(4),
  },
}))

interface DateRangeProps {
  extents: [Date, Date]
  onChange: (v: [Date, Date]) => void
  value: [Date, Date] | null
}

export default function DatesRange({ extents, value, onChange }: DateRangeProps) {
  const classes = useStyles()
  const from = value?.[0] || extents[0]
  const to = value?.[1] || extents[1]
  const handleFrom = React.useCallback(
    (event) => onChange([ymdToDate(event.target.value), to]),
    [onChange, to],
  )
  const handleTo = React.useCallback(
    (event) => onChange([from, ymdToDate(event.target.value)]),
    [onChange, from],
  )
  return (
    <div className={classes.root}>
      <M.TextField
        type="date"
        label="From"
        value={dateToYmd(from)}
        onChange={handleFrom}
        size="small"
      />
      <M.TextField
        type="date"
        label="To"
        value={dateToYmd(to)}
        onChange={handleTo}
        size="small"
      />
    </div>
  )
}
