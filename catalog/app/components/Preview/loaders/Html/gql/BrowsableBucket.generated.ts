/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../../model/graphql/types.generated'

export type components_Preview_loaders_Html_gql_BrowsableBucketQueryVariables =
  Types.Exact<{
    bucket: Types.Scalars['String']
  }>

export type components_Preview_loaders_Html_gql_BrowsableBucketQuery = {
  readonly __typename: 'Query'
} & {
  readonly bucket: Types.Maybe<
    { readonly __typename: 'Bucket' } & Pick<Types.Bucket, 'name' | 'browsable'>
  >
}

export const components_Preview_loaders_Html_gql_BrowsableBucketDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {
        kind: 'Name',
        value: 'components_Preview_loaders_Html_gql_BrowsableBucket',
      },
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
                { kind: 'Field', name: { kind: 'Name', value: 'browsable' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  components_Preview_loaders_Html_gql_BrowsableBucketQuery,
  components_Preview_loaders_Html_gql_BrowsableBucketQueryVariables
>

export { components_Preview_loaders_Html_gql_BrowsableBucketDocument as default }
