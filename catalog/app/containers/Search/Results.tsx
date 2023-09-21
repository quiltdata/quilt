import * as React from 'react'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'

const useResultsSkeletonStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(2),
    '& + &': {
      marginTop: t.spacing(1),
    },
  },
  header: {
    display: 'flex',
  },
  expand: {
    marginLeft: 'auto',
    height: t.spacing(4),
    width: t.spacing(15),
  },
  title: {
    height: t.spacing(4),
    width: '55%',
  },
  version: {
    height: t.spacing(3.5),
    width: '75%',
    marginTop: t.spacing(1),
  },
  content: {
    height: t.spacing(30),
    marginTop: t.spacing(2),
  },
}))

interface ResultsSkeletonProps {
  className?: string
}

export function ResultsSkeleton({ className }: ResultsSkeletonProps) {
  const classes = useResultsSkeletonStyles()
  return (
    <div className={className}>
      <M.Paper className={classes.root}>
        <div className={classes.header}>
          <Skeleton className={classes.title} />
          <Skeleton className={classes.expand} />
        </div>
        <Skeleton className={classes.version} />
        <Skeleton className={classes.content} />
      </M.Paper>
      <M.Paper className={classes.root}>
        <div className={classes.header}>
          <Skeleton className={classes.title} />
          <Skeleton className={classes.expand} />
        </div>
        <Skeleton className={classes.version} />
        <Skeleton className={classes.content} />
      </M.Paper>
      <M.Paper className={classes.root}>
        <div className={classes.header}>
          <Skeleton className={classes.title} />
          <Skeleton className={classes.expand} />
        </div>
        <Skeleton className={classes.version} />
        <Skeleton className={classes.content} />
      </M.Paper>
    </div>
  )
}
