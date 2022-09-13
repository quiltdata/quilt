/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type containers_Admin_Buckets_gql_BucketsRemoveMutationVariables = Types.Exact<{
  name: Types.Scalars['String']
}>

export type containers_Admin_Buckets_gql_BucketsRemoveMutation = {
  readonly __typename: 'Mutation'
} & {
  readonly bucketRemove:
    | { readonly __typename: 'BucketRemoveSuccess' }
    | { readonly __typename: 'BucketNotFound' }
    | { readonly __typename: 'IndexingInProgress' }
}

export const containers_Admin_Buckets_gql_BucketsRemoveDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'containers_Admin_Buckets_gql_BucketsRemove' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'name' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'bucketRemove' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'name' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'name' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  containers_Admin_Buckets_gql_BucketsRemoveMutation,
  containers_Admin_Buckets_gql_BucketsRemoveMutationVariables
>

export { containers_Admin_Buckets_gql_BucketsRemoveDocument as default }
