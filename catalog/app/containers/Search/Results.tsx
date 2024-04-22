import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import { ES_REF_SYNTAX } from 'components/SearchResults'
import Skeleton from 'components/Skeleton'
import { useNavBar } from 'containers/NavBar'
import StyledLink from 'utils/StyledLink'

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

const LABELS = {
  [SearchUIModel.ResultType.QuiltPackage]: 'packages',
  [SearchUIModel.ResultType.S3Object]: 'objects',
}

const useEmptyResultsStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
  },
  body: {
    maxWidth: '30rem',
  },
  list: {
    ...t.typography.body1,
    paddingLeft: 0,
  },
}))

interface EmptyResultsProps {
  className?: string
}

export function EmptyResults({ className }: EmptyResultsProps) {
  const classes = useEmptyResultsStyles()
  const {
    actions: { clearFilters, reset, setBuckets, setResultType },
    state,
  } = SearchUIModel.use()
  const focus = useNavBar()?.focus

  const startNewSearch = React.useCallback(() => {
    reset()
    focus?.()
  }, [focus, reset])

  const resetBuckets = React.useCallback(() => {
    setBuckets([])
  }, [setBuckets])

  const otherResultType =
    state.resultType === SearchUIModel.ResultType.QuiltPackage
      ? SearchUIModel.ResultType.S3Object
      : SearchUIModel.ResultType.QuiltPackage

  const switchResultType = React.useCallback(() => {
    setResultType(otherResultType)
  }, [setResultType, otherResultType])

  let numFilters = state.filter.order.length
  if (state.resultType === SearchUIModel.ResultType.QuiltPackage) {
    numFilters += state.userMetaFilters.filters.size
  }

  return (
    <div className={cx(classes.root, className)}>
      <M.Typography variant="h4">No matching {LABELS[state.resultType]}</M.Typography>

      <M.Box mt={3} />
      <M.Typography variant="body1" align="center" className={classes.body}>
        Could not find any <b>{LABELS[state.resultType]}</b> matching your search
        criteria.
        <br />
        Some suggestions to help you find what you're looking for:
      </M.Typography>

      <ul className={classes.list}>
        {state.buckets.length > 0 && (
          <li>
            Search in <StyledLink onClick={resetBuckets}>all buckets</StyledLink>
          </li>
        )}
        {numFilters > 0 && (
          <li>
            Reset the <StyledLink onClick={clearFilters}>search filters</StyledLink>
          </li>
        )}
        <li>
          Search for{' '}
          <StyledLink onClick={switchResultType}>{LABELS[otherResultType]}</StyledLink>{' '}
          instead
        </li>
        <li>
          Adjust your <StyledLink onClick={focus}>search query</StyledLink>
        </li>
        <li>
          Start <StyledLink onClick={startNewSearch}>from scratch</StyledLink>
        </li>
      </ul>
    </div>
  )
}

interface SearchErrorProps {
  className?: string
  kind?: 'unexpected' | 'syntax'
  details: React.ReactNode
}

export function SearchError({
  className,
  kind = 'unexpected',
  details,
}: SearchErrorProps) {
  const classes = useEmptyResultsStyles()
  const {
    actions: { reset },
  } = SearchUIModel.use()
  const focus = useNavBar()?.focus
  const startNewSearch = React.useCallback(
    (event) => {
      event.stopPropagation()
      reset()
      focus?.()
    },
    [reset, focus],
  )
  const tryAgain = React.useCallback(() => {
    // FIXME: retry GQL request
    window.location.reload()
  }, [])

  return (
    <div className={cx(classes.root, className)}>
      <M.Typography variant="h4">
        {kind === 'syntax' ? 'Query syntax error' : 'Unexpected error'}
      </M.Typography>
      <M.Box mt={3} />
      <M.Typography variant="body1" align="center" className={classes.body}>
        {kind === 'syntax' ? (
          <>
            Oops, couldn&apos;t parse that search.
            <br />
            Try quoting <StyledLink onClick={focus}>your query</StyledLink> or read about{' '}
            <StyledLink href={ES_REF_SYNTAX} target="_blank">
              supported query syntax
            </StyledLink>
            .
          </>
        ) : (
          <>
            Oops, something went wrong.
            <br />
            <StyledLink onClick={tryAgain}>Try again</StyledLink> or start a{' '}
            <StyledLink onClick={startNewSearch}>new search</StyledLink>.
          </>
        )}
      </M.Typography>

      <M.Box mt={3} />
      <M.Typography variant="h6">Error details</M.Typography>
      <M.Box mt={1} />
      <M.Typography variant="body2" className={classes.body}>
        {details}
      </M.Typography>
    </div>
  )
}
