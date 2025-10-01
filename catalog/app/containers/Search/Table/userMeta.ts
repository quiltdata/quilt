import * as React from 'react'

import { metadataSchema, workflowsConfig } from 'containers/Bucket/requests'
import * as AWS from 'utils/AWS'
import * as GQL from 'utils/GraphQL'
import type { JsonSchema } from 'utils/JSONSchema'
import { getSchemaItemKeysOr } from 'utils/JSONSchema'
import assertNever from 'utils/assertNever'
import type { WorkflowsConfig } from 'utils/workflows'
import { notAvailable, notSelected } from 'utils/workflows'
import * as Request from 'utils/useRequest'

import * as SearchUIModel from '../model'

import META_FACETS_QUERY from '../gql/PackageMetaFacets.generated'

interface AvailableUserMetaFacets {
  facets: readonly SearchUIModel.PackageUserMetaFacet[]
  truncated: boolean
}

function useAvailableUserMetaFacets(): Request.Result<AvailableUserMetaFacets> {
  const { state } = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)

  const filter = SearchUIModel.PackagesSearchFilterIO.toGQL(state.filter)

  const searchString = SearchUIModel.useMagicWildcardsQS(state.searchString)

  const query = GQL.useQuery(META_FACETS_QUERY, {
    searchString,
    buckets: state.buckets,
    filter,
    latestOnly: state.latestOnly,
  })

  return React.useMemo(
    () =>
      GQL.fold(query, {
        data: ({ searchPackages: r }) => {
          switch (r.__typename) {
            case 'EmptySearchResultSet':
              return { facets: [], truncated: false }
            case 'InvalidInput':
              return new Error(r.errors[0].message)
            case 'OperationError':
              return new Error(r.name)
            case 'PackagesSearchResultSet':
              return {
                facets: r.stats.userMeta.filter(
                  (f) => !state.userMetaFilters.filters.has(f.path),
                ),
                // TODO: it is not used now,
                //       but you can figure out how to show that not all columns are shown
                truncated: r.stats.userMetaTruncated,
              }
            default:
              assertNever(r)
          }
        },
        fetching: () => Request.Loading,
        error: (e) => new Error(e.message),
      }),
    [query, state.userMetaFilters.filters],
  )
}

const noKeys: string[] = []

function useWorkflowConfig(bucket?: string) {
  const s3 = AWS.S3.use()
  const req = React.useCallback(async () => {
    if (!bucket) {
      throw new Error('Bucket is required')
    }
    return workflowsConfig({ s3, bucket })
  }, [s3, bucket])

  return Request.use<WorkflowsConfig>(req, !!bucket)
}

function useMetadataSchema(
  config: Request.Result<WorkflowsConfig>,
  selectedWorkflow?: string,
) {
  const s3 = AWS.S3.use()
  const req = React.useCallback(async () => {
    if (
      config === Request.Idle ||
      config === Request.Loading ||
      config instanceof Error
    ) {
      throw config
    }
    if (config === null) return noKeys

    const workflow = selectedWorkflow
      ? getSelectedWorkflow(config, selectedWorkflow)
      : getBestWorkflow(config)

    if (workflow instanceof Error) {
      throw workflow
    }
    if (
      workflow === null || // no workflows or no default workflow
      workflow.slug === notAvailable || // UI placeholder: no config, single dummy workflow
      workflow.slug === notSelected || // UI placeholder: dummy workflow, user can select to choose "no workflow"
      !workflow.schema // workflow is not required to have `metadata_schema`
    ) {
      return noKeys
    }

    const schemaUrl = workflow.schema.url
    if (!schemaUrl) {
      throw new Error('No Schema URL found')
    }
    return metadataSchema({ s3, schemaUrl })
  }, [s3, config, selectedWorkflow])
  return Request.use<JsonSchema>(
    req,
    !(config === Request.Idle || config === Request.Loading || config instanceof Error),
  )
}

function getBestWorkflow({ workflows }: WorkflowsConfig) {
  return workflows.length === 1
    ? workflows[0]
    : workflows.find((w) => w.isDefault) || null
}

function getSelectedWorkflow({ workflows }: WorkflowsConfig, selectedWorkflow?: string) {
  return (
    workflows.find((w) => w.slug === selectedWorkflow) ||
    new Error('Selected workflow not found')
  )
}

function useMetadataRootKeys(bucket?: string, selectedWorkflow?: string) {
  const { result: config } = useWorkflowConfig(bucket)
  const { result: schema } = useMetadataSchema(config, selectedWorkflow)

  if (config === Request.Loading || config === Request.Idle) return config
  if (config instanceof Error) {
    if (config.message) return config
    // eslint-disable-next-line no-console
    console.error(config)
    return new Error('Failed loading .quilt/workflows/config.yaml')
  }

  if (schema === Request.Loading || schema === Request.Idle) return schema
  if (schema instanceof Error) {
    if (schema.message) return schema
    // eslint-disable-next-line no-console
    console.error(schema)
    return new Error(`Failed loading JSON Schema for workflow`)
  }

  return getSchemaItemKeysOr(schema, noKeys)
}

type UserMetaFacets = Map<string, SearchUIModel.PackageUserMetaFacet['__typename']>

export default function useInferredUserMetaFacets(): Request.Result<UserMetaFacets> {
  const facets = useAvailableUserMetaFacets()
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

  const workflowRootKeys = useMetadataRootKeys(
    selectedSingleBucket,
    selectedSingleWorkflow,
  )

  return React.useMemo(() => {
    if (
      facets === Request.Idle ||
      facets === Request.Loading ||
      facets instanceof Error
    ) {
      return facets
    }
    if (workflowRootKeys === Request.Loading || workflowRootKeys instanceof Error) {
      return workflowRootKeys
    }
    const allFacets: UserMetaFacets = new Map()
    const workflowFacets: UserMetaFacets = new Map()
    facets.facets.forEach(({ __typename, path }) => {
      // Already selected
      if (state.userMetaFilters.filters.has(path)) {
        return
      }

      if (
        workflowRootKeys !== Request.Idle &&
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
  }, [facets, state.userMetaFilters.filters, workflowRootKeys])
}
