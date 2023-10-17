import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'
import sand from 'components/Error/sand.webp'
import { useNavBar } from 'containers/NavBar'

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
  error: {
    fontSize: '64px',
    color: t.palette.error.dark,
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

interface EmptyResultsProps {
  className?: string
  clearTitle?: string
  description?: string
  image?: 'not-found' | 'error'
  title?: string
}

export function EmptyResults({
  className,
  clearTitle = 'Clear filters',
  description = "Try adjusting your search or filter to find what you're looking for",
  image,
  title = 'Nothing found',
}: EmptyResultsProps) {
  const classes = useEmptyResultsStyles()
  const {
    actions: { clearFilter },
  } = SearchUIModel.use()
  const navbarModel = useNavBar()
  const handleClear = React.useCallback(
    (event) => {
      event.stopPropagation()
      clearFilter()
      navbarModel?.reset()
    },
    [navbarModel, clearFilter],
  )
  const tryAgain = React.useCallback(() => {
    // FIXME: retry GQL request
    window.location.reload()
  }, [])
  return (
    <div className={cx(classes.root, className)}>
      {image === 'not-found' && <div className={classes.sand} />}
      {image === 'error' && <M.Icon className={classes.error}>error_outline</M.Icon>}
      <div className={classes.title}>{title}</div>
      <div className={classes.description}>{description}</div>
      <div className={classes.actions}>
        {image === 'error' && (
          <>
            <M.Button variant="outlined" onClick={tryAgain}>
              Try again
            </M.Button>
            <span className={classes.divider}>or</span>
          </>
        )}
        <M.Button variant="outlined" onClick={handleClear}>
          {clearTitle}
        </M.Button>
      </div>
    </div>
  )
}
