import * as React from 'react'
import * as M from '@material-ui/core'

import DateField from './DateField'

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
      <DateField date={left} extents={extents} onChange={handleGte} label="From" />
      <DateField date={right} extents={extents} onChange={handleLte} label="To" />
    </div>
  )
}
