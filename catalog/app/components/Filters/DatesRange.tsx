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

interface DateRangeProps {
  extents: { min?: Date; max?: Date }
  onChange: (v: { min: Date | null; max: Date | null }) => void
  value: { min: Date | null; max: Date | null }
}

export default function DatesRange({ extents, value, onChange }: DateRangeProps) {
  const classes = useStyles()
  const gte = value.min || extents.min || null
  const lte = value.max || extents.max || null
  const handleGte = React.useCallback(
    (min) => onChange({ min, max: lte }),
    [lte, onChange],
  )
  const handleLte = React.useCallback(
    (max) => onChange({ min: gte, max }),
    [gte, onChange],
  )
  return (
    <div className={classes.root}>
      <DateField date={gte} extents={extents} onChange={handleGte} label="From" />
      <DateField date={lte} extents={extents} onChange={handleLte} label="To" />
    </div>
  )
}
