import * as React from 'react'

import * as JSONPointer from 'utils/JSONPointer'
import * as Request from 'utils/useRequest'

import { PACKAGES_FILTERS_PRIMARY, PACKAGES_FILTERS_SECONDARY } from '../constants'
import { COLUMN_LABELS, PACKAGE_FILTER_LABELS } from '../i18n'
import * as SearchUIModel from '../model'

import type { HiddenColumns } from './Provider'
import useInferredUserMetaFacets from './userMeta'

// Skip 'name' because it is visible by default
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

const ColumnStateCreate = (state?: Partial<ColumnState>): ColumnState => ({
  filtered: state?.filtered ?? false,
  visible: state?.visible ?? false,
  inferred: state?.inferred ?? false,
})

export interface ColumnBucket {
  tag: ColumnTag.Bucket
  filter: 'bucket'
  fullTitle: string
  state: ColumnState
  title: string
}

const ColumnBucketCreate = (state?: ColumnState): ColumnBucket => ({
  tag: ColumnTag.Bucket,
  filter: 'bucket',
  fullTitle: PACKAGE_FILTER_LABELS.bucket,
  state: ColumnStateCreate(state),
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
  filter: FilterType,
  predicateType?: SearchUIModel.KnownPredicate['_tag'],
  state?: ColumnState,
): ColumnSystemMeta => ({
  tag: ColumnTag.SystemMeta,
  filter,
  fullTitle: PACKAGE_FILTER_LABELS[filter],
  predicateType: predicateType || 'Text',
  state: ColumnStateCreate(state),
  title: COLUMN_LABELS[filter],
})

const ColumnNameCreate = (state?: ColumnState): ColumnSystemMeta =>
  ColumnSystemMetaCreate('name', 'KeywordWildcard', state)

export interface ColumnUserMeta {
  tag: ColumnTag.UserMeta
  filter: JSONPointer.Pointer
  predicateType: SearchUIModel.KnownPredicate['_tag']
  // Whether ES can sort this pointer, from the facet's authoritative `sortable`
  // signal. Distinct from predicateType: a high-cardinality keyword renders as
  // a Text facet (predicateType 'Text') but is sortable. The per-column sort
  // affordance gates on this, not on predicateType — see Table/sort.ts.
  sortable: boolean
  state: ColumnState
  title: string
}

export const ColumnUserMetaCreate = (
  filter: string,
  predicateType: SearchUIModel.KnownPredicate['_tag'],
  sortable: boolean,
  state?: ColumnState,
): ColumnUserMeta => ({
  tag: ColumnTag.UserMeta,
  filter,
  predicateType,
  sortable,
  state: ColumnStateCreate(state),
  title: filter.replace(/^\//, ''),
})

export type Column = ColumnBucket | ColumnSystemMeta | ColumnUserMeta

export type ColumnsMap = Map<Column['filter'], Column>

const columnsToMap = (columns: Column[]) => new Map(columns.map((c) => [c.filter, c]))

export function useColumns(hiddenColumns: HiddenColumns, bucket?: string) {
  const inferredFacets = useInferredUserMetaFacets()

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
      return ColumnSystemMetaCreate(filter, predicate?._tag, {
        filtered: !!modifiedFilters && !!modifiedFilters[filter],
        visible: !!predicate && !hiddenColumns.has(filter),
        inferred: false,
      })
    },
    [hiddenColumns, modifiedFilters, state.filter.predicates],
  )

  const modifiedUserMetaFilters = state.userMetaFilters.toGQL()
  const createUserMetaColumn = React.useCallback(
    (
      filter: string,
      predicateType: SearchUIModel.KnownPredicate['_tag'],
      sortable: boolean,
      inferred: boolean,
    ): ColumnUserMeta =>
      ColumnUserMetaCreate(filter, predicateType, sortable, {
        filtered: !!modifiedUserMetaFilters?.find(({ path }) => path === filter),
        visible: !hiddenColumns.has(filter),
        inferred,
      }),
    [hiddenColumns, modifiedUserMetaFilters],
  )

  return React.useMemo(() => {
    const fixed = bucket
      ? [createNameColumn()]
      : [createBucketColumn(), createNameColumn()]

    const systemMeta = AVAILABLE_PACKAGES_FILTERS.map(createSystemMetaColumn)

    // Selected filters carry a predicate, not a facet, so there's no
    // authoritative `sortable` to read. Derive it from the predicate type: only
    // 'Text' is unsortable, which matches the pre-decoupling gate exactly (the
    // demoted-keyword-as-Text case only arises for inferred facets, handled
    // below with the real signal).
    const selectedUserMeta = Array.from(state.userMetaFilters.filters.entries()).map(
      ([filter, predicate]) =>
        createUserMetaColumn(filter, predicate._tag, predicate._tag !== 'Text', false),
    )

    const columns = [...fixed, ...systemMeta, ...selectedUserMeta]

    if (
      inferredFacets instanceof Error ||
      inferredFacets === Request.Loading ||
      inferredFacets === Request.Idle
    ) {
      return { columns: columnsToMap(columns), notReady: inferredFacets }
    }

    const inferredUserMeta = Array.from(inferredFacets).map(([filter, facet]) =>
      createUserMetaColumn(
        filter,
        SearchUIModel.PackageUserMetaFacetMap[facet.typename],
        facet.sortable,
        true,
      ),
    )

    return { columns: columnsToMap(columns.concat(inferredUserMeta)) }
  }, [
    createBucketColumn,
    createNameColumn,
    bucket,
    createSystemMetaColumn,
    createUserMetaColumn,
    state.userMetaFilters.filters,
    inferredFacets,
  ])
}
