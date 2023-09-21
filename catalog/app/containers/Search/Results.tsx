import * as React from 'react'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'
import sand from 'components/Error/sand.webp'

import * as SearchUIModel from './model'

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

const useEmptyResultsStyles = M.makeStyles((t) => ({
  root: {
    textAlign: 'center',
  },
  actions: {
    marginTop: t.spacing(3),
  },
  title: {
    ...t.typography.h4,
  },
  description: {
    marginTop: t.spacing(2),
    ...t.typography.body1,
  },
  divider: {
    display: 'inline-block',
    margin: t.spacing(0, 2),
    ...t.typography.body1,
  },
  sand: {
    background: `url(${sand}) repeat`,
    boxShadow: `
      inset 0 0 4px ${t.palette.background.paper},
      inset 0 0 10px ${t.palette.background.paper},
      inset 0 0 20px ${t.palette.background.paper},
      inset 0 0 50px ${t.palette.background.paper}`,
    height: '195px',
    marginBottom: t.spacing(4),
  },
}))

export function EmptyResults({
  title = 'No results found',
  description = "Try adjusting your search or filter to find what you're looking for",
}) {
  const classes = useEmptyResultsStyles()
  const model = SearchUIModel.use()
  const { activeFacets } = model.state
  const { deactivateFacet, clearFacets } = model.actions
  const lastPath = React.useMemo(
    () => activeFacets[activeFacets.length - 1]?.path,
    [activeFacets],
  )
  const deactivateLast = React.useCallback(() => {
    deactivateFacet(lastPath)
  }, [lastPath, deactivateFacet])
  return (
    <div className={classes.root}>
      <div className={classes.sand} />
      <div className={classes.title}>{title}</div>
      <div className={classes.description}>{description}</div>
      <div className={classes.actions}>
        {lastPath && (
          <>
            <M.Button variant="outlined" onClick={deactivateLast}>
              Deactivate last filter
            </M.Button>
            <span className={classes.divider}>or</span>
          </>
        )}
        <M.Button variant="outlined" onClick={clearFacets}>
          Clear filters
        </M.Button>
      </div>
    </div>
  )
}
