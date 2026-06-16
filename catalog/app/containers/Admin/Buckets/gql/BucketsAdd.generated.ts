/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import type { Json } from 'utils/types'
import * as Types from '../../../../model/graphql/types.generated'

export interface BucketAddInput {
  readonly browsable: boolean | null | undefined
  readonly delayScan: boolean | null | undefined
  readonly description: string | null | undefined
  readonly fileExtensionsToIndex: Array<string> | null | undefined
  readonly iconUrl: string | null | undefined
  readonly indexContentBytes: number | null | undefined
  readonly linkedData: Json | null | undefined
  readonly name: string
  readonly overviewUrl: string | null | undefined
  readonly prefixes: Array<string> | null | undefined
  readonly relevanceScore: number | null | undefined
  readonly scannerParallelShardsDepth: number | null | undefined
  readonly skipMetaDataIndexing: boolean | null | undefined
  readonly snsNotificationArn: string | null | undefined
  readonly tags: Array<string> | null | undefined
  readonly title: string
}

export type containers_Admin_Buckets_gql_BucketsAddMutationVariables = Exact<{
  input: Types.BucketAddInput
}>

export interface containers_Admin_Buckets_gql_BucketsAddMutation {
  readonly __typename: 'Mutation'
  readonly bucketAdd:
    | {
        readonly __typename: 'BucketAddSuccess'
        readonly bucketConfig: {
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
        }
      }
    | { readonly __typename: 'BucketAlreadyAdded' }
    | { readonly __typename: 'BucketDoesNotExist' }
    | { readonly __typename: 'BucketFileExtensionsToIndexInvalid' }
    | { readonly __typename: 'BucketIndexContentBytesInvalid' }
    | { readonly __typename: 'InsufficientPermissions'; readonly message: string }
    | { readonly __typename: 'NotificationConfigurationError' }
    | { readonly __typename: 'NotificationTopicNotFound' }
    | { readonly __typename: 'SnsInvalid' }
    | { readonly __typename: 'SubscriptionInvalid' }
}

export const containers_Admin_Buckets_gql_BucketsAddDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'containers_Admin_Buckets_gql_BucketsAdd' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'input' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'BucketAddInput' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'bucketAdd' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'input' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'InlineFragment',
                  typeCondition: {
                    kind: 'NamedType',
                    name: { kind: 'Name', value: 'BucketAddSuccess' },
                  },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'bucketConfig' },
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
                  kind: 'InlineFragment',
                  typeCondition: {
                    kind: 'NamedType',
                    name: { kind: 'Name', value: 'InsufficientPermissions' },
                  },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                    ],
                  },
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
  containers_Admin_Buckets_gql_BucketsAddMutation,
  containers_Admin_Buckets_gql_BucketsAddMutationVariables
>

export { containers_Admin_Buckets_gql_BucketsAddDocument as default }
