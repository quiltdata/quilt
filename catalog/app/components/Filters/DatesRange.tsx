import * as dateFns from 'date-fns'
import * as React from 'react'
import * as M from '@material-ui/core'

const ymdToDate = (ymd: string): Date => new Date(ymd)

const dateToYmd = (date: Date): string => dateFns.format(date, 'yyyy-MM-dd')

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
  onChange: (v: { min: Date | null; max: Date | null }) => void
  value: { min: Date | null; max: Date | null }
}

export default function DatesRange({ extents, value, onChange }: DateRangeProps) {
  const classes = useStyles()
  const min = value.min || extents.min
  const max = value.max || extents.max
  const handleFrom = React.useCallback(
    (event) => onChange({ min: ymdToDate(event.target.value), max }),
    [onChange, max],
  )
  const handleTo = React.useCallback(
    (event) => onChange({ min, max: ymdToDate(event.target.value) }),
    [onChange, min],
  )
  return (
    <div className={classes.root}>
      <M.TextField
        className={classes.input}
        label="From"
        onChange={handleFrom}
        size="small"
        type="date"
        value={dateToYmd(min)}
        variant="outlined"
      />
      <M.TextField
        className={classes.input}
        label="To"
        onChange={handleTo}
        size="small"
        type="date"
        value={dateToYmd(max)}
        variant="outlined"
      />
    </div>
  )
}
