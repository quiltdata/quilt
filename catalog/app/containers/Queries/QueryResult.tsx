import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import JsonDisplay from 'components/JsonDisplay'

const useStyles = M.makeStyles({
  root: {},
})

interface QueryResultProps {
  loading: boolean
  value: object | null
}

function QueryResultSkeleton() {
  const t = M.useTheme()
  return <Lab.Skeleton height={t.spacing(3)} width="100%" />
}

export default function QueryResult({ loading, value }: QueryResultProps) {
  const classes = useStyles()

  if (loading) return <QueryResultSkeleton />

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
