import * as React from 'react'

import * as GQL from 'utils/GraphQL'
import assertNever from 'utils/assertNever'

import { PACKAGES_FILTERS_PRIMARY, PACKAGES_FILTERS_SECONDARY } from '../constants'
import { COLUMN_LABELS, PACKAGE_FILTER_LABELS } from '../i18n'
import * as SearchUIModel from '../model'

import META_FACETS_QUERY from '../gql/PackageMetaFacets.generated'

import * as Workflow from './workflow'
import type { HiddenColumns } from './Provider'

const AVAILABLE_PACKAGES_FILTERS = [
  ...PACKAGES_FILTERS_PRIMARY,
  ...PACKAGES_FILTERS_SECONDARY,
]

export type FilterType =
  SearchUIModel.FilterStateForResultType<SearchUIModel.ResultType.QuiltPackage>['order'][number]

interface ColumnState {
  filtered: boolean
  visible: boolean
  inferred: boolean
}

interface ColumnBase {
  state: ColumnState
}

export interface ColumnBucket extends ColumnBase {
  filter: 'bucket'
  tag: 'bucket'
  title: string
}

export interface ColumnFilter extends ColumnBase {
  filter: FilterType
  fullTitle: string
  predicateType: SearchUIModel.KnownPredicate['_tag']
  tag: 'filter'
  title: string
}

export interface ColumnMeta extends ColumnBase {
  filter: string
  predicateType: SearchUIModel.KnownPredicate['_tag']
  tag: 'meta'
  title: string
}

export type Column = ColumnBucket | ColumnFilter | ColumnMeta

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

  const fixed = React.useMemo(() => {
    const nameCol: Column = {
      predicateType: 'KeywordWildcard' as const,
      filter: 'name' as const,
      fullTitle: PACKAGE_FILTER_LABELS.name,
      tag: 'filter' as const,
      title: COLUMN_LABELS.name,
      state: {
        filtered: !!modifiedFilters && !!modifiedFilters.name,
        visible: !hiddenColumns.has('name'),
        inferred: false,
      },
    }
    if (bucket) return [nameCol]
    const bucketCol: Column = {
      filter: 'bucket' as const,
      tag: 'bucket' as const,
      title: COLUMN_LABELS.bucket,
      state: {
        filtered: !!state.buckets.length,
        visible: !hiddenColumns.has('bucket'),
        inferred: false,
      },
    }
    return [bucketCol, nameCol]
  }, [state.buckets.length, modifiedFilters, hiddenColumns, bucket])

  const filters = React.useMemo(() => {
    const output: Column[] = []

    AVAILABLE_PACKAGES_FILTERS.forEach((filter) => {
      const predicate = state.filter.predicates[filter]
      // 'name' is added in `fixed` columns
      if (filter !== 'name') {
        output.push({
          predicateType: predicate?._tag || 'Text',
          filter,
          fullTitle: PACKAGE_FILTER_LABELS[filter],
          tag: 'filter' as const,
          title: COLUMN_LABELS[filter],
          state: {
            filtered: !!modifiedFilters && !!modifiedFilters[filter],
            visible: !!predicate && !hiddenColumns.has(filter),
            inferred: false,
          },
        })
      }
    })
    return output
  }, [hiddenColumns, state.filter, modifiedFilters])

  const selectedUserMeta = React.useMemo(() => {
    const modifiedUserMetaFilters = state.userMetaFilters.toGQL()
    const output: Column[] = []
    state.userMetaFilters.filters.forEach((predicate, filter) => {
      output.push({
        predicateType: predicate._tag,
        filter,
        tag: 'meta' as const,
        title: filter.replace(/^\//, ''),
        state: {
          filtered: !!modifiedUserMetaFilters?.find(({ path }) => path === filter),
          visible: !hiddenColumns.has(filter),
          inferred: false,
        },
      })
    })
    return output
  }, [hiddenColumns, state.userMetaFilters])

  const inferedUserMeta = React.useMemo(() => {
    const output: Column[] = []
    if (infered instanceof Error || infered === Workflow.Loading) return infered
    const list = Object.keys(infered.workflow).length ? infered.workflow : infered.all
    for (const filter in list) {
      output.push({
        predicateType: SearchUIModel.PackageUserMetaFacetMap[list[filter]],
        filter,
        tag: 'meta' as const,
        title: filter.replace(/^\//, ''),
        state: {
          filtered: false,
          visible: !hiddenColumns.has(filter),
          inferred: true,
        },
      })
    }
    return output
  }, [hiddenColumns, infered])

  return React.useMemo(() => {
    const list = [...fixed, ...filters, ...selectedUserMeta]
    if (inferedUserMeta instanceof Error || inferedUserMeta === Workflow.Loading) {
      return [columnsToMap(list), inferedUserMeta]
    }
    return [columnsToMap(list.concat(inferedUserMeta)), null]
  }, [fixed, filters, selectedUserMeta, inferedUserMeta])
}
