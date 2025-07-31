import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import { ES_REF_SYNTAX } from 'components/SearchResults'
import { docs } from 'constants/urls'
import * as GQL from 'utils/GraphQL'
import StyledLink from 'utils/StyledLink'

import * as Hit from './List/Hit'
import { Table as TableSkeleton } from './Table/Skeleton'
import * as SearchUIModel from './model'

interface SkeletonProps {
  className?: string
  state: SearchUIModel.SearchUrlState
}

export function Skeleton({ className, state }: SkeletonProps) {
  if (state.view === SearchUIModel.View.Table) {
    return <TableSkeleton className={className} />
  }

  const Component =
    state.resultType === SearchUIModel.ResultType.QuiltPackage
      ? Hit.PackageSkeleton
      : Hit.ObjectSkeleton
  return (
    <div className={className}>
      <Component />
      <Component />
      <Component />
      <Component />
      <Component />
    </div>
  )
}

const LABELS = {
  [SearchUIModel.ResultType.QuiltPackage]: 'packages',
  [SearchUIModel.ResultType.S3Object]: 'objects',
}

const useEmptyStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
  },
  body: {
    maxWidth: '30rem',
    marginTop: t.spacing(3),
  },
  list: {
    ...t.typography.body1,
    paddingLeft: 0,
  },
  create: {
    maxWidth: '30rem',
    borderBottom: `1px solid ${t.palette.divider}`,
    marginTop: t.spacing(2),
    paddingBottom: t.spacing(2),
  },
  details: {
    marginTop: t.spacing(3),
  },
}))

export enum Refine {
  Buckets,
  ResultType,
  Filters,
  Search,
  New,
  Network,
}

interface EmptyProps {
  className?: string
  onRefine: (action: Exclude<Refine, Refine.Network>) => void
}

export function Empty({ className, onRefine }: EmptyProps) {
  const classes = useEmptyStyles()
  const { baseSearchQuery, state } = SearchUIModel.use()

  const otherResultType =
    state.resultType === SearchUIModel.ResultType.QuiltPackage
      ? SearchUIModel.ResultType.S3Object
      : SearchUIModel.ResultType.QuiltPackage

  const getTotalResults = (resultType: SearchUIModel.ResultType) =>
    GQL.fold(baseSearchQuery, {
      data: (data) => {
        const r =
          resultType === SearchUIModel.ResultType.QuiltPackage
            ? data.searchPackages
            : data.searchObjects
        switch (r.__typename) {
          case 'EmptySearchResultSet':
            return 0
          case 'ObjectsSearchResultSet':
          case 'PackagesSearchResultSet':
            return r.total >= 0 ? r.total : null
          default:
            return null
        }
      },
      fetching: () => null,
      error: () => null,
    })

  const totalOtherResults = getTotalResults(otherResultType)

  let numFilters = state.filter.order.length
  if (state.resultType === SearchUIModel.ResultType.QuiltPackage) {
    numFilters += state.userMetaFilters.filters.size
  }

  return (
    <div className={cx(classes.root, className)}>
      <M.Typography variant="h4">No matching {LABELS[state.resultType]}</M.Typography>

      <M.Typography variant="body1" align="center" className={classes.body}>
        Search for{' '}
        <StyledLink onClick={() => onRefine(Refine.ResultType)}>
          {LABELS[otherResultType]}
        </StyledLink>{' '}
        instead{totalOtherResults != null && ` (${totalOtherResults} found)`} or adjust
        your search:
      </M.Typography>

      <ul className={classes.list}>
        {state.buckets.length > 0 && (
          <li>
            Search in{' '}
            <StyledLink onClick={() => onRefine(Refine.Buckets)}>all buckets</StyledLink>
          </li>
        )}
        {numFilters > 0 && (
          <li>
            Reset the{' '}
            <StyledLink onClick={() => onRefine(Refine.Filters)}>
              search filters
            </StyledLink>
          </li>
        )}
        <li>
          Edit your{' '}
          <StyledLink onClick={() => onRefine(Refine.Search)}>search query</StyledLink>
        </li>
        <li>
          Start <StyledLink onClick={() => onRefine(Refine.New)}>from scratch</StyledLink>
        </li>
      </ul>
    </div>
  )
}

interface SecureSearchProps {
  className?: string
  onLoadMore: () => void
  onRefine: (action: Refine.New) => void
}

export function SecureSearch({ className, onLoadMore, onRefine }: SecureSearchProps) {
  return (
    <div className={className}>
      <Hit.PackagePlaceholder>
        The initial batch of results was filtered out due to{' '}
        <StyledLink
          href={`${docs}/quilt-platform-catalog-user/search#secure-search`}
          target="_blank"
        >
          secure search
        </StyledLink>
        .
        <br />
        <StyledLink onClick={onLoadMore}>Load more</StyledLink> to try additional results,
        or{' '}
        <StyledLink onClick={() => onRefine(Refine.New)}>
          enter a different search
        </StyledLink>
        .
      </Hit.PackagePlaceholder>
    </div>
  )
}

const useErrorDetailsStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
  },
  body: {
    maxWidth: '30rem',
    marginTop: t.spacing(4),
  },
}))

interface ErrorDetailsProps {
  className: string
  children: React.ReactNode
}

function ErrorDetails({ className, children }: ErrorDetailsProps) {
  const classes = useErrorDetailsStyles()
  return (
    <div className={cx(classes.root, className)}>
      <M.Typography variant="h6">Error details</M.Typography>
      <M.Typography variant="body2" className={classes.body} component="div">
        {children}
      </M.Typography>
    </div>
  )
}

export interface UnexpectedErrorProps {
  className?: string
  children: React.ReactNode
  onRefine: (action: Refine.Network | Refine.New) => void
}

export function UnexpectedError({ className, children, onRefine }: UnexpectedErrorProps) {
  const classes = useEmptyStyles()
  return (
    <div className={cx(classes.root, className)}>
      <M.Typography variant="h4">Unexpected error</M.Typography>
      <M.Box mt={3} />
      <M.Typography variant="body1" align="center" className={classes.body}>
        Oops, something went wrong.
        <br />
        <StyledLink onClick={() => onRefine(Refine.Network)}>Try again</StyledLink> or
        start a <StyledLink onClick={() => onRefine(Refine.New)}>new search</StyledLink>.
      </M.Typography>

      <ErrorDetails className={classes.details}>{children}</ErrorDetails>
    </div>
  )
}

export interface SyntaxErrorProps {
  className?: string
  children: React.ReactNode
  onRefine: (action: Refine.Search) => void
}

export function SyntaxError({ className, children, onRefine }: SyntaxErrorProps) {
  const classes = useEmptyStyles()
  return (
    <div className={cx(classes.root, className)}>
      <M.Typography variant="h4">Query syntax error</M.Typography>
      <M.Box mt={3} />
      <M.Typography variant="body1" align="center" className={classes.body}>
        Oops, couldn&apos;t parse that search.
        <br />
        Try quoting{' '}
        <StyledLink onClick={() => onRefine(Refine.Search)}>your query</StyledLink> or
        read about{' '}
        <StyledLink href={ES_REF_SYNTAX} target="_blank">
          supported query syntax
        </StyledLink>
        .
      </M.Typography>

      <ErrorDetails className={classes.details}>{children}</ErrorDetails>
    </div>
  )
}
