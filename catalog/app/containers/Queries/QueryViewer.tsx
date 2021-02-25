import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import JsonDisplay from 'components/JsonDisplay'

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(3, 4, 4),
  },
}))

interface QueryViewerProps {
  error: Error | null
  loading: boolean
  value: object | null
}

function QueryViewerSkeleton() {
  const t = M.useTheme()
  return (
    <>
      <Lab.Skeleton height={t.spacing(2)} width="100%" />
      <Lab.Skeleton height={t.spacing(2)} width="100%" />
      <Lab.Skeleton height={t.spacing(2)} width="100%" />
      <Lab.Skeleton height={t.spacing(2)} width="100%" />
      <Lab.Skeleton height={t.spacing(2)} width="100%" />
    </>
  )
}

export default function QueryViewer({ error, loading, value }: QueryViewerProps) {
  const classes = useStyles()

  if (error) return <Lab.Alert severity="error">{error.message}</Lab.Alert>

  if (loading) return <QueryViewerSkeleton />

  if (!value) return null

  return (
    <M.Paper className={classes.root}>
      <JsonDisplay className="" value={value} name={undefined} topLevel defaultExpanded />
    </M.Paper>
  )
}
