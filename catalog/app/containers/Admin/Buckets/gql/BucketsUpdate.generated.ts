/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

import {
  BucketConfigSelectionFragment,
  BucketConfigSelectionFragmentDoc,
} from './BucketConfigSelection.generated'

export type containers_Admin_Buckets_gql_BucketsUpdateMutationVariables = Types.Exact<{
  name: Types.Scalars['String']
  input: Types.BucketUpdateInput
}>

export type containers_Admin_Buckets_gql_BucketsUpdateMutation = {
  readonly __typename: 'Mutation'
} & {
  readonly bucketUpdate:
    | ({ readonly __typename: 'BucketUpdateSuccess' } & {
        readonly bucketConfig: {
          readonly __typename: 'BucketConfig'
        } & BucketConfigSelectionFragment
      })
    | { readonly __typename: 'BucketFileExtensionsToIndexInvalid' }
    | { readonly __typename: 'BucketIndexContentBytesInvalid' }
    | { readonly __typename: 'BucketNotFound' }
    | { readonly __typename: 'NotificationConfigurationError' }
    | { readonly __typename: 'NotificationTopicNotFound' }
    | { readonly __typename: 'SnsInvalid' }
}

export const containers_Admin_Buckets_gql_BucketsUpdateDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'containers_Admin_Buckets_gql_BucketsUpdate' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'name' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'input' } },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'BucketUpdateInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'bucketUpdate' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'name' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'name' } },
              },
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
                    name: { kind: 'Name', value: 'BucketUpdateSuccess' },
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
              ],
            },
          },
        ],
      },
    },
    ...BucketConfigSelectionFragmentDoc.definitions,
  ],
} as unknown as DocumentNode<
  containers_Admin_Buckets_gql_BucketsUpdateMutation,
  containers_Admin_Buckets_gql_BucketsUpdateMutationVariables
>

export { containers_Admin_Buckets_gql_BucketsUpdateDocument as default }
