import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import JsonDisplay from 'components/JsonDisplay'

const useStyles = M.makeStyles({
  root: {},
})

interface QueryViewerProps {
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

export default function QueryViewer({ loading, value }: QueryViewerProps) {
  const classes = useStyles()

  if (loading) return <QueryViewerSkeleton />

  if (!value) return null

  return (
    <JsonDisplay
      value={value}
      name={undefined}
      topLevel
      defaultExpanded
      className={classes.root}
    />
  )
}
