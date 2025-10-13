/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type containers_Admin_Buckets_gql_TabulatorTablesSetMutationVariables =
  Types.Exact<{
    bucketName: Types.Scalars['String']
    tableName: Types.Scalars['String']
    config: Types.Maybe<Types.Scalars['String']>
  }>

export type containers_Admin_Buckets_gql_TabulatorTablesSetMutation = {
  readonly __typename: 'Mutation'
} & {
  readonly bucketSetTabulatorTable:
    | ({ readonly __typename: 'BucketConfig' } & Pick<Types.BucketConfig, 'name'> & {
          readonly tabulatorTables: ReadonlyArray<
            { readonly __typename: 'TabulatorTable' } & Pick<
              Types.TabulatorTable,
              'name' | 'config'
            >
          >
        })
    | ({ readonly __typename: 'InvalidInput' } & {
        readonly errors: ReadonlyArray<
          { readonly __typename: 'InputError' } & Pick<
            Types.InputError,
            'path' | 'name' | 'message' | 'context'
          >
        >
      })
    | ({ readonly __typename: 'OperationError' } & Pick<
        Types.OperationError,
        'name' | 'message' | 'context'
      >)
}

export const containers_Admin_Buckets_gql_TabulatorTablesSetDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'containers_Admin_Buckets_gql_TabulatorTablesSet' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'bucketName' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'tableName' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'config' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'bucketSetTabulatorTable' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'bucketName' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'bucketName' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'tableName' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'tableName' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'config' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'config' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
                {
                  kind: 'InlineFragment',
                  typeCondition: {
                    kind: 'NamedType',
                    name: { kind: 'Name', value: 'BucketConfig' },
                  },
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
                            { kind: 'Field', name: { kind: 'Name', value: 'config' } },
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
                    name: { kind: 'Name', value: 'InvalidInput' },
                  },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'errors' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'path' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'context' } },
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
                    name: { kind: 'Name', value: 'OperationError' },
                  },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'context' } },
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
  containers_Admin_Buckets_gql_TabulatorTablesSetMutation,
  containers_Admin_Buckets_gql_TabulatorTablesSetMutationVariables
>

export { containers_Admin_Buckets_gql_TabulatorTablesSetDocument as default }
