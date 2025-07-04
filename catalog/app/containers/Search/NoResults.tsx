import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import { ES_REF_SYNTAX } from 'components/SearchResults'
import { docs } from 'constants/urls'
import { usePackageCreationDialog } from 'containers/Bucket/PackageDialog/PackageCreationForm'
import { useNavBar } from 'containers/NavBar'
import * as GQL from 'utils/GraphQL'
import StyledLink from 'utils/StyledLink'

import * as Hit from './List/Hit'
import { Table as TableSkeleton } from './Table/Skeleton'
import * as SearchUIModel from './model'

const EXAMPLE_PACKAGE_URL = `${docs}/walkthrough/editing-a-package`

const useCreatePackageStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    marginRight: t.spacing(2),
    flexShrink: 0,
  },
  docs: {
    flexBasis: '40%',
  },
}))

interface CreatePackageProps {
  bucket: string
  className: string
}

function CreatePackage({ bucket, className }: CreatePackageProps) {
  const classes = useCreatePackageStyles()
  const createDialog = usePackageCreationDialog({
    bucket,
    delayHashing: true,
    disableStateDisplay: true,
  })
  const handleClick = React.useCallback(() => createDialog.open(), [createDialog])
  return (
    <div className={cx(className, classes.root)}>
      <M.Button
        className={classes.button}
        color="primary"
        onClick={handleClick}
        variant="contained"
      >
        Create package
      </M.Button>
      <M.Typography className={classes.docs}>
        or{' '}
        <StyledLink href={EXAMPLE_PACKAGE_URL} target="_blank">
          push a package
        </StyledLink>{' '}
        with the Quilt Python API.
      </M.Typography>

      {createDialog.render({
        successTitle: 'Package created',
        successRenderMessage: ({ packageLink }) => (
          <>Package {packageLink} successfully created</>
        ),
        title: 'Create package',
      })}
    </div>
  )
}

interface SkeletonProps {
  className?: string
  state: SearchUIModel.SearchUrlState
}

export function Skeleton({ className, state }: SkeletonProps) {
  if (state.view === SearchUIModel.View.Table) return <TableSkeleton />

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
}))

interface EmptyProps {
  bucket?: string
  className?: string
}

export function Empty({ bucket, className }: EmptyProps) {
  const classes = useEmptyStyles()
  const {
    actions: { clearFilters, reset, setBuckets, setResultType },
    baseSearchQuery,
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
            return r.stats.total
          default:
            return null
        }
      },
      fetching: () => null,
      error: () => null,
    })

  const totalOtherResults = getTotalResults(otherResultType)

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

      {state.resultType === SearchUIModel.ResultType.QuiltPackage && !!bucket && (
        <CreatePackage bucket={bucket} className={classes.create} />
      )}

      <M.Typography variant="body1" align="center" className={classes.body}>
        Search for{' '}
        <StyledLink onClick={switchResultType}>{LABELS[otherResultType]}</StyledLink>{' '}
        instead{totalOtherResults != null && ` (${totalOtherResults} found)`} or adjust
        your search:
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
          Edit your <StyledLink onClick={focus}>search query</StyledLink>
        </li>
        <li>
          Start <StyledLink onClick={startNewSearch}>from scratch</StyledLink>
        </li>
      </ul>
    </div>
  )
}

interface ErrorProps {
  className?: string
  kind?: 'unexpected' | 'syntax'
  children: React.ReactNode
}

export function Error({ className, kind = 'unexpected', children }: ErrorProps) {
  const classes = useEmptyStyles()
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
        {children}
      </M.Typography>
    </div>
  )
}
