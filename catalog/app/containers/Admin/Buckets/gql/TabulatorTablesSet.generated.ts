/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../../model/graphql/types.generated'

import type { JsonRecord } from 'utils/types'
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type containers_Admin_Buckets_gql_TabulatorTablesSetMutationVariables = Exact<{
  bucketName: string
  tableName: string
  config: string | null | undefined
}>

export interface containers_Admin_Buckets_gql_TabulatorTablesSetMutation {
  readonly __typename: 'Mutation'
  readonly bucketSetTabulatorTable:
    | {
        readonly __typename: 'BucketConfig'
        readonly name: string
        readonly tabulatorTables: ReadonlyArray<{
          readonly __typename: 'TabulatorTable'
          readonly name: string
          readonly config: string
        }>
      }
    | {
        readonly __typename: 'InvalidInput'
        readonly errors: ReadonlyArray<{
          readonly __typename: 'InputError'
          readonly path: string | null
          readonly name: string
          readonly message: string
          readonly context: JsonRecord | null
        }>
      }
    | {
        readonly __typename: 'OperationError'
        readonly name: string
        readonly message: string
        readonly context: JsonRecord | null
      }
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
