/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type containers_Bucket_Tabulator_gql_TabulatorTablesQueryVariables = Types.Exact<{
  bucket: Types.Scalars['String']
}>

export type containers_Bucket_Tabulator_gql_TabulatorTablesQuery = {
  readonly __typename: 'Query'
} & {
  readonly bucketConfig: Types.Maybe<
    { readonly __typename: 'BucketConfig' } & Pick<Types.BucketConfig, 'name'> & {
        readonly tabulatorTables: ReadonlyArray<
          { readonly __typename: 'TabulatorTable' } & Pick<Types.TabulatorTable, 'name'>
        >
      }
  >
}

export const containers_Bucket_Tabulator_gql_TabulatorTablesDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Bucket_Tabulator_gql_TabulatorTables' },
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
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'tabulatorTables' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
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
} as unknown as DocumentNode<
  containers_Bucket_Tabulator_gql_TabulatorTablesQuery,
  containers_Bucket_Tabulator_gql_TabulatorTablesQueryVariables
>

export { containers_Bucket_Tabulator_gql_TabulatorTablesDocument as default }
