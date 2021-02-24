import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import JsonDisplay from 'components/JsonDisplay'

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(3, 4, 4),
  },
}))

interface QueryResultProps {
  className: string
  loading: boolean
  value: object | null
}

function QueryResultSkeleton() {
  const t = M.useTheme()
  return <Lab.Skeleton height={t.spacing(3)} width="100%" />
}

export default function QueryResult({ className, loading, value }: QueryResultProps) {
  const classes = useStyles()

  if (loading) return <QueryResultSkeleton />

  if (!value) return null

  return (
    <M.Paper className={cx(classes.root, className)}>
      <JsonDisplay className="" value={value} name={undefined} topLevel defaultExpanded />
    </M.Paper>
  )
}
