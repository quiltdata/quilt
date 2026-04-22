/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type containers_Bucket_Overview_gql_BucketQueryVariables = Types.Exact<{
  bucket: Types.Scalars['String']
}>

export type containers_Bucket_Overview_gql_BucketQuery = {
  readonly __typename: 'Query'
} & {
  readonly bucket: Types.Maybe<
    { readonly __typename: 'Bucket' } & Pick<Types.Bucket, 'name' | 'description'>
  >
}

export const containers_Bucket_Overview_gql_BucketDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Bucket_Overview_gql_Bucket' },
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
            name: { kind: 'Name', value: 'bucket' },
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
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'description' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  containers_Bucket_Overview_gql_BucketQuery,
  containers_Bucket_Overview_gql_BucketQueryVariables
>

export { containers_Bucket_Overview_gql_BucketDocument as default }
