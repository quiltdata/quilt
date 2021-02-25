import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import JsonDisplay from 'components/JsonDisplay'

import * as requests from './requests'

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(3, 4, 4),
  },
}))

interface QueryViewerProps {
  query: requests.QueryData
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

export default function QueryViewer({ query }: QueryViewerProps) {
  const classes = useStyles()

  if (query.error) return <Lab.Alert severity="error">{query.error.message}</Lab.Alert>

  if (query.loading) return <QueryViewerSkeleton />

  if (!query.value) return null

  return (
    <M.Paper className={classes.root}>
      <JsonDisplay
        className=""
        value={query.value}
        name={undefined}
        topLevel
        defaultExpanded
      />
    </M.Paper>
  )
}
