import * as React from 'react'
import * as RR from 'react-router-dom'
import * as M from '@material-ui/core'

import * as SearchUIModel from 'containers/Search/model'
import { createBoundary } from 'utils/ErrorBoundary'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import assertNever from 'utils/assertNever'

import { useBucketStrict } from 'containers/Bucket/Routes'
import Main from 'containers/Search/Layout/Main'
import { Refine, Error as NoResultsError } from 'containers/Search/NoResults'
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
          order: SearchUIModel.DEFAULT_ORDER,
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
  const [inputEl, setInputEl] = React.useState<HTMLInputElement | null>(null)
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
          inputEl?.select()
          break
        case Refine.New:
          reset()
          inputEl?.focus()
          break
        case Refine.Network:
          // TODO: retry GQL request
          window.location.reload()
          break
        default:
          assertNever(action)
      }
    },
    [inputEl, goToGlobalSearchUrl, resultType, clearFilters, setResultType, reset],
  )
  const emptyFallback = <NoPackages bucket={bucket} onRefine={handleRefine} />
  return (
    <>
      <MetaTitle>{titleSegments}</MetaTitle>
      <Main inputRef={setInputEl}>
        {tableView ? (
          <TableResults
            bucket={bucket}
            emptyFallback={emptyFallback}
            onRefine={handleRefine}
          />
        ) : (
          <ListResults emptyFallback={emptyFallback} onRefine={handleRefine} />
        )}
      </Main>
    </>
  )
}

const usePackageListErrorBoundaryStyles = M.makeStyles((t) => ({
  root: {
    margin: t.spacing(3, 0),
  },
}))

interface PackageListErrorBoundaryProps {
  bucket: string
  error: Error
}

function PackageListErrorBoundary({ bucket, error }: PackageListErrorBoundaryProps) {
  const classes = usePackageListErrorBoundaryStyles()
  const history = RR.useHistory()
  const { urls } = NamedRoutes.use<RouteMap>()
  const handleRefine = React.useCallback(
    (action: Refine) => {
      if (action === Refine.Network) {
        // TODO: retry GQL request
        window.location.reload()
      } else {
        history.push(urls.bucketPackageList(bucket))
      }
    },
    [bucket, history, urls],
  )
  return (
    <NoResultsError className={classes.root} onRefine={handleRefine}>
      {error.message}
    </NoResultsError>
  )
}

const ErrorBoundary = createBoundary(
  ({ bucket }: { bucket: string }) =>
    (error: Error) => <PackageListErrorBoundary bucket={bucket} error={error} />,
  'PackageListErrorBoundary',
)

export default function PackageListWrapper() {
  const location = RR.useLocation()
  const bucket = useBucketStrict()
  const { urls } = NamedRoutes.use<RouteMap>()
  const defaults = React.useMemo(
    () => ({
      buckets: [bucket],
      order: SearchUIModel.ResultOrder.NEWEST,
      view: SearchUIModel.View.Table,
    }),
    [bucket],
  )
  return (
    <ErrorBoundary bucket={bucket} key={JSON.stringify(location)}>
      <SearchUIModel.Provider base={urls.bucketPackageList(bucket)} defaults={defaults}>
        <PackageList bucket={bucket} />
      </SearchUIModel.Provider>
    </ErrorBoundary>
  )
}
