/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../../model/graphql/types.generated'

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type containers_Admin_Buckets_gql_BucketConfigsQueryVariables = Exact<{
  [key: string]: never
}>

export interface containers_Admin_Buckets_gql_BucketConfigsQuery {
  readonly __typename: 'Query'
  readonly bucketConfigs: ReadonlyArray<{
    readonly __typename: 'BucketConfig'
    readonly name: string
    readonly title: string
    readonly iconUrl: string | null
    readonly description: string | null
    readonly relevanceScore: number
    readonly tags: ReadonlyArray<string> | null
    readonly fileExtensionsToIndex: ReadonlyArray<string> | null
    readonly indexContentBytes: number | null
    readonly scannerParallelShardsDepth: number | null
    readonly snsNotificationArn: string | null
    readonly skipMetaDataIndexing: boolean | null
    readonly lastIndexed: Date | null
    readonly browsable: boolean
  }>
}

export const containers_Admin_Buckets_gql_BucketConfigsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Admin_Buckets_gql_BucketConfigs' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'bucketConfigs' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'BucketConfigSelection' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'BucketConfigSelection' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'BucketConfig' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'iconUrl' } },
          { kind: 'Field', name: { kind: 'Name', value: 'description' } },
          { kind: 'Field', name: { kind: 'Name', value: 'relevanceScore' } },
          { kind: 'Field', name: { kind: 'Name', value: 'tags' } },
          { kind: 'Field', name: { kind: 'Name', value: 'fileExtensionsToIndex' } },
          { kind: 'Field', name: { kind: 'Name', value: 'indexContentBytes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'scannerParallelShardsDepth' } },
          { kind: 'Field', name: { kind: 'Name', value: 'snsNotificationArn' } },
          { kind: 'Field', name: { kind: 'Name', value: 'skipMetaDataIndexing' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lastIndexed' } },
          { kind: 'Field', name: { kind: 'Name', value: 'browsable' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  containers_Admin_Buckets_gql_BucketConfigsQuery,
  containers_Admin_Buckets_gql_BucketConfigsQueryVariables
>

export { containers_Admin_Buckets_gql_BucketConfigsDocument as default }
