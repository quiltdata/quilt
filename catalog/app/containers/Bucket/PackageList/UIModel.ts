import * as Eff from 'effect'
import invariant from 'invariant'
import * as React from 'react'
import * as RR from 'react-router-dom'
import type { ResultOf } from '@graphql-typed-document-node/core'

import * as Model from 'model'
import * as GQL from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import mkStorage from 'utils/storage'
import useDebouncedInput from 'utils/useDebouncedInput'
import useMemoEq from 'utils/useMemoEq'

import * as PD from '../PackageDialog'

import PACKAGE_COUNT_QUERY from './gql/PackageCount.generated'
import PACKAGE_LIST_QUERY from './gql/PackageList.generated'

export const SORT_OPTIONS = [
  {
    key: 'modified',
    value: Model.GQLTypes.PackageListOrder.MODIFIED,
    label: 'Updated',
  },
  {
    key: 'name',
    value: Model.GQLTypes.PackageListOrder.NAME,
    label: 'Name',
  },
] as const

export type SortMode = (typeof SORT_OPTIONS)[number]['key']

export const DEFAULT_SORT = SORT_OPTIONS[0]

export const PER_PAGE = 30

// Possible values are 'modified', 'name'
export const storage = mkStorage({ sortPackagesBy: 'SORT_PACKAGES_BY' })

export type AccessCounts = NonNullable<
  NonNullable<
    ResultOf<typeof PACKAGE_LIST_QUERY>['packages']
  >['page'][number]['accessCounts']
>

export type PackageSelection = NonNullable<
  ResultOf<typeof PACKAGE_LIST_QUERY>['packages']
>['page'][number]

export const getSort = (key: unknown) => {
  if (!key) return DEFAULT_SORT
  return SORT_OPTIONS.find((o) => o.key === key) || DEFAULT_SORT
}

interface PackageListUrlState {
  bucket: string
  sort: string | undefined
  filter: string | undefined
  page: number | undefined
  // searchString: string | null
  // order: ResultOrder
  // filter: FilterStateForResultType<ResultType.S3Object>
}

// TODO: use Effect/Schema-based Navigation/Route system
function useUrlState(): PackageListUrlState {
  const l = RR.useLocation()
  const { bucket } = RR.useParams<{ bucket: string }>()
  invariant(!!bucket, '`bucket` must be defined')

  const { sort, filter, p } = parseSearch(l.search, true)
  const page = p ? parseInt(p, 10) : undefined

  return useMemoEq({ bucket, sort, filter, page }, Eff.Function.identity)
}

function useUIModel() {
  const urlState = useUrlState()

  const { urls } = NamedRoutes.use()
  const history = RR.useHistory()

  const computedPage = urlState.page || 1
  const computedSort = getSort(urlState.sort)
  const computedFilter = urlState.filter || ''

  const filtering = useDebouncedInput(computedFilter, 500)

  const totalCountQuery = GQL.useQuery(PACKAGE_COUNT_QUERY, {
    bucket: urlState.bucket,
    filter: null,
  })

  const filteredCountQuery = GQL.useQuery(PACKAGE_COUNT_QUERY, {
    bucket: urlState.bucket,
    filter: urlState.filter || null,
  })

  const packagesQuery = GQL.useQuery(PACKAGE_LIST_QUERY, {
    bucket: urlState.bucket,
    filter: urlState.filter || null,
    order: computedSort.value,
    page: computedPage,
    perPage: PER_PAGE,
  })

  const makeSortUrl = React.useCallback(
    (s) =>
      urls.bucketPackageList(urlState.bucket, {
        filter: urlState.filter,
        sort: s === DEFAULT_SORT.key ? undefined : s,
        // reset page if sort order changed
        p: s === computedSort.key ? urlState.page : undefined,
      }),
    [urls, urlState.bucket, urlState.filter, computedSort, urlState.page],
  )

  const makePageUrl = React.useCallback(
    (newP) =>
      urls.bucketPackageList(urlState.bucket, {
        filter: urlState.filter,
        sort: urlState.sort,
        p: newP !== 1 ? newP : undefined,
      }),
    [urls, urlState.bucket, urlState.filter, urlState.sort],
  )

  // const updateUrlState = React.useCallback(
  //   (updater: (s: PackageListUrlState) => PackageListUrlState) => {
  //     const newState = updater(urlState)
  //     if (R.equals(newState, urlState)) return
  //     history.push(makeUrl(newState))
  //   },
  //   [urlState, makeUrl, history],
  // )
  //
  // const setSearchString = React.useCallback(
  //   (searchString: string | null) => {
  //     // XXX: reset other params? e.g. filters
  //     updateUrlState((s) => ({ ...s, searchString }))
  //   },
  //   [updateUrlState],
  // )
  //
  // const setOrder = React.useCallback(
  //   (order: ResultOrder) => {
  //     updateUrlState((s) => ({ ...s, order }))
  //   },
  //   [updateUrlState],
  // )

  // set filter query param on filter input change (debounced)
  React.useEffect(() => {
    if (filtering.value !== computedFilter) {
      history.push(
        urls.bucketPackageList(urlState.bucket, {
          filter: filtering.value || undefined,
          sort: urlState.sort,
        }),
      )
    }
  }, [history, urls, urlState.bucket, urlState.sort, filtering.value, computedFilter])

  // set sort query param to previously selected
  const sortPackagesBy = storage.load()?.sortPackagesBy
  React.useEffect(() => {
    if (urlState.sort || urlState.sort === sortPackagesBy) return
    switch (sortPackagesBy) {
      case 'modified':
      case 'name':
        history.replace(makeSortUrl(sortPackagesBy))
      // no default
    }
  }, [history, makeSortUrl, urlState.sort, sortPackagesBy])

  const createDialog = PD.usePackageCreationDialog({
    bucket: urlState.bucket,
    delayHashing: true,
    disableStateDisplay: true,
  })

  const openPackageCreationDialog = React.useCallback(
    () => createDialog.open(),
    [createDialog],
  )

  return useMemoEq(
    {
      state: {
        ...urlState,
      },
      actions: {},
      computed: {
        page: computedPage,
        sort: computedSort,
      },
      filtering,
      totalCountQuery,
      filteredCountQuery,
      packagesQuery,
      makeSortUrl,
      makePageUrl,
      packageCreationDialog: {
        dialog: createDialog,
        open: openPackageCreationDialog,
      },
    },
    Eff.Function.identity,
  )
}

export type UIModel = ReturnType<typeof useUIModel>

export const Context = React.createContext<UIModel | null>(null)

export function UIModelProvider({ children }: React.PropsWithChildren<{}>) {
  const value = useUIModel()
  return React.createElement(Context.Provider, { value }, children)
}

export function useUIModelContext() {
  const model = React.useContext(Context)
  invariant(model, 'PackageListUIModel accessed outside of provider')
  return model
}

export { UIModelProvider as Provider, useUIModelContext as use }
