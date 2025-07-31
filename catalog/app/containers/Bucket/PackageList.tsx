import * as React from 'react'
import { ErrorBoundary, FallbackProps } from 'react-error-boundary'
import * as RR from 'react-router-dom'
import * as M from '@material-ui/core'

import { useBucketStrict } from 'containers/Bucket/Routes'
import ListResults from 'containers/Search/List'
import Main from 'containers/Search/Layout/Main'
import * as NoResults from 'containers/Search/NoResults'
import TableResults from 'containers/Search/Table'
import * as SearchUIModel from 'containers/Search/model'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import assertNever from 'utils/assertNever'

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
    (action: NoResults.Refine) => {
      switch (action) {
        case NoResults.Refine.Buckets:
          goToGlobalSearchUrl()
          break
        case NoResults.Refine.ResultType:
          const otherResultType =
            resultType === SearchUIModel.ResultType.QuiltPackage
              ? SearchUIModel.ResultType.S3Object
              : SearchUIModel.ResultType.QuiltPackage
          setResultType(otherResultType)
          break
        case NoResults.Refine.Filters:
          clearFilters()
          break
        case NoResults.Refine.Search:
          inputEl?.select()
          break
        case NoResults.Refine.New:
          reset()
          inputEl?.focus()
          break
        case NoResults.Refine.Network:
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

function PackageListErrorBoundary({ error, resetErrorBoundary }: FallbackProps) {
  const classes = usePackageListErrorBoundaryStyles()
  const handleRefine: NoResults.UnexpectedErrorProps['onRefine'] = React.useCallback(
    (action) =>
      action === NoResults.Refine.Network
        ? window.location.reload() // TODO: retry GQL request
        : resetErrorBoundary(),
    [resetErrorBoundary],
  )
  return (
    <NoResults.Error className={classes.root} onRefine={handleRefine}>
      {error.message}
    </NoResults.Error>
  )
}

export default function PackageListWrapper() {
  const bucket = useBucketStrict()
  const { push } = RR.useHistory()
  const { urls } = NamedRoutes.use<RouteMap>()
  const defaults = React.useMemo(
    () => ({
      buckets: [bucket],
      order: SearchUIModel.ResultOrder.NEWEST,
      view: SearchUIModel.View.Table,
    }),
    [bucket],
  )
  const onReset = React.useCallback(
    () => push(urls.bucketPackageList(bucket)),
    [bucket, push, urls],
  )
  return (
    <ErrorBoundary FallbackComponent={PackageListErrorBoundary} onReset={onReset}>
      <SearchUIModel.Provider base={urls.bucketPackageList(bucket)} defaults={defaults}>
        <PackageList bucket={bucket} />
      </SearchUIModel.Provider>
    </ErrorBoundary>
  )
}
