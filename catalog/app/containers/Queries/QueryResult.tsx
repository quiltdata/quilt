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

interface QueryResultProps {
  className: string
  results: requests.ResultsData
}

function QueryResultSkeleton() {
  const t = M.useTheme()
  return <Lab.Skeleton height={t.spacing(3)} width="100%" />
}

export default function QueryResult({ className, results }: QueryResultProps) {
  const classes = useStyles()

  if (results.error)
    return <Lab.Alert severity="error">{results.error.message}</Lab.Alert>

  if (results.loading) return <QueryResultSkeleton />

  if (!results.value) return null

  return (
    <div className={className}>
      <M.Typography variant="h6">Search results</M.Typography>
      <M.Paper className={classes.content}>
        <JsonDisplay
          className=""
          value={results.value}
          name={undefined}
          topLevel
          defaultExpanded
        />
      </M.Paper>
    </div>
  )
}
