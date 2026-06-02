import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import { useRouteMatch } from 'react-router-dom'
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as urql from 'urql'

import cfg from 'constants/config'
import * as AuthSelectors from 'containers/Auth/selectors'
import * as Types from 'model/graphql/types.generated'
import * as GQL from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'

import BUCKETS_QUERY from './Buckets.generated'

type Buckets = GQL.DataForDoc<typeof BUCKETS_QUERY>['buckets']
type ProductBucketsQuery = GQL.DataForDoc<typeof BUCKETS_QUERY>
type ProductBucketsQueryVariables = GQL.VariablesForDoc<typeof BUCKETS_QUERY>

type LocalBucketsQueryVariables = Record<string, never>

type LocalBucketsQuery = {
  readonly buckets: ReadonlyArray<
    { readonly __typename: 'BucketConfig' } & Pick<
      Types.BucketConfig,
      'name' | 'title' | 'iconUrl' | 'description' | 'tags' | 'relevanceScore'
    >
  >
}

type SupportedBucketsQuery = ProductBucketsQuery | LocalBucketsQuery
type SupportedBucketsQueryVariables =
  | ProductBucketsQueryVariables
  | LocalBucketsQueryVariables

const LOCAL_BUCKETS_QUERY = urql.gql`
  query utils_LocalBuckets {
    buckets: bucketConfigs {
      name
      title
      iconUrl
      description
      tags
      relevanceScore
    }
  }
` as DocumentNode<LocalBucketsQuery, LocalBucketsQueryVariables>

const EMPTY: Buckets = []

function normalizeLocalBuckets(data: LocalBucketsQuery): Buckets {
  return data.buckets.map(({ __typename: _typename, ...bucket }) => ({
    __typename: 'Bucket' as const,
    ...bucket,
  }))
}

// always suspended
function useBuckets() {
  const authenticated = redux.useSelector(AuthSelectors.authenticated)
  // XXX: consider moving this logic to gql resolver
  const empty = cfg.alwaysRequiresAuth && !authenticated
  const query = cfg.mode === 'LOCAL' ? LOCAL_BUCKETS_QUERY : BUCKETS_QUERY
  const variables =
    cfg.mode === 'LOCAL'
      ? undefined
      : ({ includeCollaborators: cfg.mode === 'PRODUCT' } as ProductBucketsQueryVariables)

  try {
    const data = GQL.useQueryS<SupportedBucketsQuery, SupportedBucketsQueryVariables>(
      query,
      variables,
      { pause: empty },
    )
    return cfg.mode === 'LOCAL'
      ? normalizeLocalBuckets(data as LocalBucketsQuery)
      : (data as ProductBucketsQuery).buckets
  } catch (e) {
    if (e instanceof GQL.Paused) return EMPTY
    throw e
  }
}

// XXX: consider deprecating this in favor of direct graphql usage
export const useRelevantBuckets = () => {
  const bs = useBuckets()
  return React.useMemo(() => {
    const filtered = bs.filter((b) => b.relevanceScore >= 0)
    const sorted = R.sortWith(
      [R.descend(R.prop('relevanceScore')), R.ascend(R.prop('name'))],
      filtered,
    )
    return sorted
  }, [bs])
}

export const useCurrentBucket = () => {
  const { paths } = NamedRoutes.use()
  return useRouteMatch<{ bucket: string }>(paths.bucketRoot)?.params.bucket
}

export function useIsInStack() {
  const buckets = useBuckets()
  return React.useCallback(
    (bucket: string) => buckets.some((b) => b.name === bucket),
    [buckets],
  )
}
