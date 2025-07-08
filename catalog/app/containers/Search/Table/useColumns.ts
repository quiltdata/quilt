import * as React from 'react'

import * as JSONPointer from 'utils/JSONPointer'

import { PACKAGES_FILTERS_PRIMARY, PACKAGES_FILTERS_SECONDARY } from '../constants'
import { COLUMN_LABELS, PACKAGE_FILTER_LABELS } from '../i18n'
import * as SearchUIModel from '../model'

import * as Workflow from './workflow'
import type { HiddenColumns } from './Provider'

// Skip 'name' because, it is visible by default
const AVAILABLE_PACKAGES_FILTERS = [
  ...PACKAGES_FILTERS_PRIMARY,
  ...PACKAGES_FILTERS_SECONDARY,
].filter((f) => f !== 'name')

export type FilterType =
  SearchUIModel.FilterStateForResultType<SearchUIModel.ResultType.QuiltPackage>['order'][number]

export enum ColumnTag {
  Bucket,
  UserMeta,
  SystemMeta,
}

interface ColumnState {
  filtered: boolean
  visible: boolean
  inferred: boolean
}

export interface ColumnBucket {
  tag: ColumnTag.Bucket
  filter: 'bucket'
  fullTitle: string
  state: ColumnState
  title: string
}

const ColumnBucketCreate = (state: ColumnState): ColumnBucket => ({
  tag: ColumnTag.Bucket,
  filter: 'bucket',
  fullTitle: PACKAGE_FILTER_LABELS.bucket,
  state,
  title: COLUMN_LABELS.bucket,
})

export interface ColumnSystemMeta {
  tag: ColumnTag.SystemMeta
  filter: FilterType
  fullTitle: string
  predicateType: SearchUIModel.KnownPredicate['_tag']
  state: ColumnState
  title: string
}

const ColumnSystemMetaCreate = (
  state: ColumnState,
  filter: FilterType,
  predicateType?: SearchUIModel.KnownPredicate['_tag'],
): ColumnSystemMeta => ({
  tag: ColumnTag.SystemMeta,
  filter,
  fullTitle: PACKAGE_FILTER_LABELS[filter],
  predicateType: predicateType || 'Text',
  state,
  title: COLUMN_LABELS[filter],
})

const ColumnNameCreate = (state: ColumnState): ColumnSystemMeta =>
  ColumnSystemMetaCreate(state, 'name', 'KeywordWildcard')

export interface ColumnUserMeta {
  tag: ColumnTag.UserMeta
  filter: JSONPointer.Pointer
  predicateType: SearchUIModel.KnownPredicate['_tag']
  state: ColumnState
  title: string
}

const ColumnUserMetaCreate = (
  state: ColumnState,
  filter: string,
  predicateType: SearchUIModel.KnownPredicate['_tag'],
): ColumnUserMeta => ({
  tag: ColumnTag.UserMeta,
  filter,
  predicateType,
  state,
  title: filter.replace(/^\//, ''),
})

export type Column = ColumnBucket | ColumnSystemMeta | ColumnUserMeta

type UserMetaFacets = Map<string, SearchUIModel.PackageUserMetaFacet['__typename']>

function useInferredUserMetaFacets(
  metaFiltersState: SearchUIModel.AvailableFiltersStateInstance,
): Workflow.RequestResult<UserMetaFacets> {
  const { state } = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const selectedSingleBucket = React.useMemo(() => {
    if (state.buckets.length !== 1) return
    return state.buckets[0]
  }, [state.buckets])

  const selectedSingleWorkflow = React.useMemo(() => {
    const workflows = state.filter.predicates.workflow
    if (!workflows || workflows.terms.length !== 1) return
    return workflows.terms[0]
  }, [state.filter.predicates.workflow])

  const workflowRootKeys = Workflow.useMetadataRootKeys(
    selectedSingleBucket,
    selectedSingleWorkflow,
  )

  return React.useMemo(() => {
    if (workflowRootKeys instanceof Error) return workflowRootKeys
    return SearchUIModel.AvailableFiltersState.match(
      {
        Loading: (): Workflow.RequestResult<UserMetaFacets> => Workflow.Loading,
        Empty: () => new Map(),
        Ready: ({ facets }) => {
          const allFacets: UserMetaFacets = new Map()
          const workflowFacets: UserMetaFacets = new Map()
          facets.available.forEach(({ __typename, path }) => {
            // Already selected
            if (state.userMetaFilters.filters.has(path)) {
              return
            }

            // Not found in the latest workflow schema
            if (
              workflowRootKeys !== Workflow.Loading &&
              workflowRootKeys.includes(path.replace(/^\//, ''), 0)
            ) {
              // Use keywords when possible
              if (workflowFacets.get(path) !== 'KeywordPackageUserMetaFacet') {
                // TODO: keep sort order from workflow
                workflowFacets.set(path, __typename)
              }
            }

            // If workflow has facets, then we will use only them
            // and we don't need to keep fillng `allFacets`
            if (workflowFacets.size) return

            // Use keywords when possible
            if (allFacets.get(path) !== 'KeywordPackageUserMetaFacet') {
              allFacets.set(path, __typename)
            }
          })
          return workflowFacets.size ? workflowFacets : allFacets
        },
      },
      metaFiltersState,
    )
  }, [metaFiltersState, state.userMetaFilters.filters, workflowRootKeys])
}

export type ColumnsMap = Map<Column['filter'], Column>

const columnsToMap = (columns: Column[]) => new Map(columns.map((c) => [c.filter, c]))

type InferedColumnsNotReady = Exclude<
  Workflow.RequestResult<UserMetaFacets>,
  UserMetaFacets
>

export function useColumns(
  hiddenColumns: HiddenColumns,
  metaFiltersState: SearchUIModel.AvailableFiltersStateInstance,
  bucket?: string,
): [ColumnsMap, InferedColumnsNotReady | null] {
  const infered: Workflow.RequestResult<UserMetaFacets> =
    useInferredUserMetaFacets(metaFiltersState)

  const { state } = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)

  const modifiedFilters = React.useMemo(
    () => SearchUIModel.PackagesSearchFilterIO.toGQL(state.filter),
    [state.filter],
  )

  const createNameColumn = React.useCallback(
    (): ColumnSystemMeta =>
      ColumnNameCreate({
        filtered: !!modifiedFilters && !!modifiedFilters.name,
        visible: !hiddenColumns.has('name'),
        inferred: false,
      }),
    [hiddenColumns, modifiedFilters],
  )

  const createBucketColumn = React.useCallback(
    (): ColumnBucket =>
      ColumnBucketCreate({
        filtered: !!state.buckets.length,
        visible: !hiddenColumns.has('bucket'),
        inferred: false,
      }),
    [hiddenColumns, state.buckets.length],
  )

  const createSystemMetaColumn = React.useCallback(
    (filter: FilterType) => {
      const predicate = state.filter.predicates[filter]
      return ColumnSystemMetaCreate(
        {
          filtered: !!modifiedFilters && !!modifiedFilters[filter],
          visible: !!predicate && !hiddenColumns.has(filter),
          inferred: false,
        },
        filter,
        predicate?._tag,
      )
    },
    [hiddenColumns, modifiedFilters, state.filter.predicates],
  )

  const modifiedUserMetaFilters = state.userMetaFilters.toGQL()
  const createUserMetaColumn = React.useCallback(
    (
      filter: string,
      predicateType: SearchUIModel.KnownPredicate['_tag'],
      inferred: boolean,
    ): ColumnUserMeta =>
      ColumnUserMetaCreate(
        {
          filtered: !!modifiedUserMetaFilters?.find(({ path }) => path === filter),
          visible: !hiddenColumns.has(filter),
          inferred,
        },
        filter,
        predicateType,
      ),
    [hiddenColumns, modifiedUserMetaFilters],
  )

  return React.useMemo(() => {
    const fixed = bucket
      ? [createNameColumn()]
      : [createBucketColumn(), createNameColumn()]

    const systemMeta = AVAILABLE_PACKAGES_FILTERS.map(createSystemMetaColumn)

    const selectedUserMeta = Array.from(state.userMetaFilters.filters.entries()).map(
      ([filter, predicate]) => createUserMetaColumn(filter, predicate._tag, false),
    )

    const columns = [...fixed, ...systemMeta, ...selectedUserMeta]

    if (infered instanceof Error || infered === Workflow.Loading) {
      return [columnsToMap(columns), infered]
    }

    const inferedUserMeta = Array.from(infered).map(([filter, predicateType]) =>
      createUserMetaColumn(
        filter,
        SearchUIModel.PackageUserMetaFacetMap[predicateType],
        true,
      ),
    )

    return [columnsToMap(columns.concat(inferedUserMeta)), null]
  }, [
    createBucketColumn,
    createNameColumn,
    bucket,
    createSystemMetaColumn,
    createUserMetaColumn,
    state.userMetaFilters.filters,
    infered,
  ])
}
