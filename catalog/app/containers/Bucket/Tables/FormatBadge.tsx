import * as React from 'react'
import * as M from '@material-ui/core'

import type { TableFormat } from './requests'

// One small chip, reused everywhere a table renders (list row, detail header).
// Colors distinguish formats at a glance: Iceberg teal, Parquet gray.

const useStyles = M.makeStyles((t) => ({
  iceberg: {
    backgroundColor: t.palette.type === 'dark' ? '#00695c' : '#b2dfdb',
    color: t.palette.getContrastText(t.palette.type === 'dark' ? '#00695c' : '#b2dfdb'),
  },
}))

const LABELS: Record<TableFormat, string> = {
  iceberg: 'Iceberg',
  parquet: 'Parquet',
  other: 'Table',
}

interface FormatBadgeProps {
  className?: string
  format: TableFormat
}

export default function FormatBadge({ className, format }: FormatBadgeProps) {
  const classes = useStyles()
  return (
    <M.Chip
      className={className}
      classes={format === 'iceberg' ? { root: classes.iceberg } : undefined}
      label={LABELS[format]}
      size="small"
      variant={format === 'iceberg' ? 'default' : 'outlined'}
    />
  )
}
