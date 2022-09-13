/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

import {
  BucketConfigSelectionFragment,
  BucketConfigSelectionFragmentDoc,
} from './BucketConfigSelection.generated'

export type containers_Admin_Buckets_gql_BucketsAddMutationVariables = Types.Exact<{
  input: Types.BucketAddInput
}>

export type containers_Admin_Buckets_gql_BucketsAddMutation = {
  readonly __typename: 'Mutation'
} & {
  readonly bucketAdd:
    | ({ readonly __typename: 'BucketAddSuccess' } & {
        readonly bucketConfig: {
          readonly __typename: 'BucketConfig'
        } & BucketConfigSelectionFragment
      })
    | { readonly __typename: 'BucketAlreadyAdded' }
    | { readonly __typename: 'BucketDoesNotExist' }
    | { readonly __typename: 'BucketFileExtensionsToIndexInvalid' }
    | { readonly __typename: 'BucketIndexContentBytesInvalid' }
    | { readonly __typename: 'InsufficientPermissions' }
    | { readonly __typename: 'NotificationConfigurationError' }
    | { readonly __typename: 'NotificationTopicNotFound' }
    | { readonly __typename: 'SnsInvalid' }
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
              ],
            },
          },
        ],
      },
    },
    ...BucketConfigSelectionFragmentDoc.definitions,
  ],
} as unknown as DocumentNode<
  containers_Admin_Buckets_gql_BucketsAddMutation,
  containers_Admin_Buckets_gql_BucketsAddMutationVariables
>

export { containers_Admin_Buckets_gql_BucketsAddDocument as default }
