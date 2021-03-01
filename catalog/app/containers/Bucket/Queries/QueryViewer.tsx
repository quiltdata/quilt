import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import JsonDisplay from 'components/JsonDisplay'

import * as requests from './requests'

const useStyles = M.makeStyles((t) => ({
  content: {
    margin: t.spacing(1, 0, 0),
    padding: t.spacing(3, 4, 4),
  },
}))

interface QueryViewerProps {
  className: string
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

export default function QueryViewer({ className, query }: QueryViewerProps) {
  const classes = useStyles()

  if (query.error) return <Lab.Alert severity="error">{query.error.message}</Lab.Alert>

  if (query.loading) return <QueryViewerSkeleton />

  if (!query.value) return null

  return (
    <div className={className}>
      <M.Typography variant="body1">Query body</M.Typography>
      <M.Paper className={classes.content}>
        <JsonDisplay
          className=""
          value={query.value}
          name={undefined}
          topLevel
          defaultExpanded
        />
      </M.Paper>
    </div>
  )
}
