import * as React from 'react'
import * as RR from 'react-router-dom'

import * as SearchUIModel from 'containers/Search/model'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import assertNever from 'utils/assertNever'

import { useBucketStrict } from 'containers/Bucket/Routes'
import Main from 'containers/Search/Layout/Main'
import { Refine } from 'containers/Search/NoResults'
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

  return (
    <>
      <MetaTitle>{titleSegments}</MetaTitle>
      <Main inputRef={setInputEl}>
        {tableView ? (
          <TableResults
            bucket={bucket}
            emptyFallback={<NoPackages bucket={bucket} onRefine={handleRefine} />}
            onRefine={handleRefine}
          />
        ) : (
          <ListResults onRefine={handleRefine} />
        )}
      </Main>
    </>
  )
}

export default function PackageListWrapper() {
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
    <SearchUIModel.Provider base={urls.bucketPackageList(bucket)} defaults={defaults}>
      <PackageList bucket={bucket} />
    </SearchUIModel.Provider>
  )
}
