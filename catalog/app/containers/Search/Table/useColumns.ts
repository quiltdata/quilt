import * as React from 'react'

import * as GQL from 'utils/GraphQL'
import assertNever from 'utils/assertNever'
import * as JSONPointer from 'utils/JSONPointer'

import { PACKAGES_FILTERS_PRIMARY, PACKAGES_FILTERS_SECONDARY } from '../constants'
import { COLUMN_LABELS, PACKAGE_FILTER_LABELS } from '../i18n'
import * as SearchUIModel from '../model'

import META_FACETS_QUERY from '../gql/PackageMetaFacets.generated'

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
  title: string
  state: ColumnState
}

const ColumnBucketCreate = (state: ColumnState): ColumnBucket => ({
  tag: ColumnTag.Bucket,
  filter: 'bucket',
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

type UserMetaFacets = Record<string, SearchUIModel.PackageUserMetaFacet['__typename']>

interface InferedUserMetaFacets {
  workflow: UserMetaFacets
  all: UserMetaFacets
}

function useInferredUserMetaFacets(): Workflow.RequestResult<InferedUserMetaFacets> {
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

  const searchString = SearchUIModel.useMagicWildcardsQS(state.searchString)
  const query = GQL.useQuery(META_FACETS_QUERY, {
    searchString,
    buckets: state.buckets,
    filter: SearchUIModel.PackagesSearchFilterIO.toGQL(state.filter),
    latestOnly: state.latestOnly,
  })

  return React.useMemo(
    () =>
      GQL.fold(query, {
        data: ({ searchPackages: r }) => {
          if (workflowRootKeys instanceof Error) return workflowRootKeys
          switch (r.__typename) {
            case 'EmptySearchResultSet':
            case 'InvalidInput':
              return new Error('Failed to load user meta')
            case 'PackagesSearchResultSet':
              const output: InferedUserMetaFacets = { all: {}, workflow: {} }
              r.stats.userMeta.forEach(({ __typename, path }) => {
                // Already selected
                if (state.userMetaFilters.filters.has(path)) {
                  return
                }

                // Not found in the latest workflow schema
                if (
                  workflowRootKeys !== Workflow.Loading &&
                  workflowRootKeys.indexOf(path.replace(/^\//, '')) > -1
                ) {
                  if (output.workflow[path] !== 'KeywordPackageUserMetaFacet') {
                    // TODO: keep sort order from workflow
                    output.workflow[path] = __typename
                  }
                }

                if (output.all[path] !== 'KeywordPackageUserMetaFacet') {
                  output.all[path] = __typename
                }
              })
              return output

            default:
              assertNever(r)
          }
        },
        fetching: () => Workflow.Loading,
        error: (e) => e,
      }),
    [state.userMetaFilters.filters, query, workflowRootKeys],
  )
}

export type ColumnsMap = Map<Column['filter'], Column>

const columnsToMap = (columns: Column[]) => new Map(columns.map((c) => [c.filter, c]))

type InferedColumnsNotReady = Exclude<
  Workflow.RequestResult<InferedUserMetaFacets>,
  InferedUserMetaFacets
>

export function useColumns(
  hiddenColumns: HiddenColumns,
  bucket?: string,
): [ColumnsMap, InferedColumnsNotReady | null] {
  const infered: Workflow.RequestResult<InferedUserMetaFacets> =
    useInferredUserMetaFacets()

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

    const list = [...fixed, ...systemMeta, ...selectedUserMeta]

    if (infered instanceof Error || infered === Workflow.Loading) {
      return [columnsToMap(list), infered]
    }

    const inferedUserMeta = Object.entries(
      Object.keys(infered.workflow).length ? infered.workflow : infered.all,
    ).map(([filter, predicateType]) =>
      createUserMetaColumn(
        filter,
        SearchUIModel.PackageUserMetaFacetMap[predicateType],
        true,
      ),
    )
    return [columnsToMap(list.concat(inferedUserMeta)), null]
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
