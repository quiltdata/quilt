import * as React from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import * as RR from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Sentry from '@sentry/react'

import { useSearchInput } from 'components/Layout'
import * as SearchUIModel from 'containers/Search/model'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import assertNever from 'utils/assertNever'

import { useBucketStrict } from 'containers/Bucket/Routes'
import Main from 'containers/Search/Layout/Main'
import {
  Error as SearchErrorScreen,
  Refine,
  useErrorRefine,
} from 'containers/Search/NoResults'
import ListResults from 'containers/Search/List'
import TableResults from 'containers/Search/Table'

import NoPackages from './NoPackages'
import type { RouteMap } from './Routes'

function useGoToGlobalSearchUrl() {
  const { state } = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const globalSearch = SearchUIModel.useMakeUrl()
  const history = RR.useHistory()
  return React.useCallback(
    () =>
      history.push(
        globalSearch({
          ...state,
          buckets: [],
          ordering: SearchUIModel.DEFAULT_ORDERING,
          view: SearchUIModel.DEFAULT_VIEW,
        }),
      ),
    [globalSearch, history, state],
  )
}

interface PackageListProps {
  bucket: string
}

function PackageList({ bucket }: PackageListProps) {
  const {
    actions: { clearFilters, reset, setResultType },
    state: { resultType, searchString, view },
  } = SearchUIModel.use()
  const tableView =
    view === SearchUIModel.View.Table &&
    resultType === SearchUIModel.ResultType.QuiltPackage
  const titleSegments = React.useMemo(() => {
    const base = ['Packages', bucket]
    return searchString ? [...base, searchString] : base
  }, [bucket, searchString])

  const goToGlobalSearchUrl = useGoToGlobalSearchUrl()
  // The query field is the header bar's, not this screen's.
  const searchInput = useSearchInput()
  const handleRefine = React.useCallback(
    (action: Refine) => {
      switch (action) {
        case Refine.Buckets:
          goToGlobalSearchUrl()
          break
        case Refine.ResultType:
          const otherResultType =
            resultType === SearchUIModel.ResultType.QuiltPackage
              ? SearchUIModel.ResultType.S3Object
              : SearchUIModel.ResultType.QuiltPackage
          setResultType(otherResultType)
          break
        case Refine.Filters:
          clearFilters()
          break
        case Refine.Search:
          searchInput.select()
          break
        case Refine.New:
          reset()
          searchInput.focus()
          break
        case Refine.Network:
          // TODO: retry GQL request
          window.location.reload()
          break
        default:
          assertNever(action)
      }
    },
    [searchInput, goToGlobalSearchUrl, resultType, clearFilters, setResultType, reset],
  )

  const emptySlot = <NoPackages bucket={bucket} onRefine={handleRefine} />
  return (
    <>
      <MetaTitle>{titleSegments}</MetaTitle>
      <Main>
        {tableView ? (
          <TableResults bucket={bucket} emptySlot={emptySlot} onRefine={handleRefine} />
        ) : (
          <ListResults emptySlot={emptySlot} onRefine={handleRefine} />
        )}
      </Main>
    </>
  )
}

const useErrorFallbackStyles = M.makeStyles((t) => ({
  root: {
    margin: t.spacing(3, 0),
  },
}))

// Same containment as the global search page: the model parses the URL in its
// own render, so a filter param that won't parse escapes every boundary below
// and takes the whole catalog down with it. See Search/Search.tsx.
//
// Deliberately not wrapped in `Search/Layout/Main` the way the loaded page is:
// Main reads the search model, so it would throw here -- and a boundary does
// not catch what its own fallback throws.
function PackageListErrorFallback({ error }: FallbackProps) {
  const classes = useErrorFallbackStyles()
  const bucket = useBucketStrict()
  const { urls } = NamedRoutes.use<RouteMap>()
  const onRefine = useErrorRefine(urls.bucketPackageList(bucket))
  return (
    <SearchErrorScreen className={classes.root} onRefine={onRefine}>
      {error.message}
    </SearchErrorScreen>
  )
}

const onError = (error: Error) => Sentry.captureException(error)

export default function PackageListWrapper() {
  const bucket = useBucketStrict()
  const { search } = RR.useLocation()
  const { urls } = NamedRoutes.use<RouteMap>()
  const defaults = React.useMemo(
    () => ({
      buckets: [bucket],
      ordering: 'sys:modified:desc',
      view: SearchUIModel.View.Table,
    }),
    [bucket],
  )
  return (
    <ErrorBoundary
      FallbackComponent={PackageListErrorFallback}
      onError={onError}
      resetKeys={[search]}
    >
      <SearchUIModel.Provider base={urls.bucketPackageList(bucket)} defaults={defaults}>
        <PackageList bucket={bucket} />
      </SearchUIModel.Provider>
    </ErrorBoundary>
  )
}
