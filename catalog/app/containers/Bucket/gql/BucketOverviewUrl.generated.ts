/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../model/graphql/types.generated'

export type containers_Bucket_gql_BucketOverviewUrlQueryVariables = Types.Exact<{
  bucket: Types.Scalars['String']
}>

export type containers_Bucket_gql_BucketOverviewUrlQuery = {
  readonly __typename: 'Query'
} & {
  readonly bucketConfig: Types.Maybe<
    { readonly __typename: 'BucketConfig' } & Pick<Types.BucketConfig, 'overviewUrl'>
  >
}

export const containers_Bucket_gql_BucketOverviewUrlDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Bucket_gql_BucketOverviewUrl' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'bucket' } },
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
            name: { kind: 'Name', value: 'bucketConfig' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'name' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'bucket' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'overviewUrl' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  containers_Bucket_gql_BucketOverviewUrlQuery,
  containers_Bucket_gql_BucketOverviewUrlQueryVariables
>

export { containers_Bucket_gql_BucketOverviewUrlDocument as default }
