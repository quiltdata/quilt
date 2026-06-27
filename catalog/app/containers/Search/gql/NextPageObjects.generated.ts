/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../model/graphql/types.generated'

import type { JsonRecord } from 'utils/types'
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type containers_Search_gql_NextPageObjectsQueryVariables = Exact<{
  after: string
}>

export interface containers_Search_gql_NextPageObjectsQuery {
  readonly __typename: 'Query'
  readonly searchMoreObjects:
    | {
        readonly __typename: 'InvalidInput'
        readonly errors: ReadonlyArray<{
          readonly __typename: 'InputError'
          readonly path: string | null
          readonly message: string
          readonly name: string
          readonly context: JsonRecord | null
        }>
      }
    | {
        readonly __typename: 'ObjectsSearchResultSetPage'
        readonly cursor: string | null
        readonly hits: ReadonlyArray<{
          readonly __typename: 'SearchHitObject'
          readonly id: string
          readonly bucket: string
          readonly score: number
          readonly size: number
          readonly modified: Date
          readonly key: string
          readonly version: string
          readonly deleted: boolean
          readonly indexedContent: string | null
        }>
      }
    | {
        readonly __typename: 'OperationError'
        readonly name: string
        readonly message: string
        readonly context: JsonRecord | null
      }
}

export const containers_Search_gql_NextPageObjectsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Search_gql_NextPageObjects' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'after' } },
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
            name: { kind: 'Name', value: 'searchMoreObjects' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'after' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'after' } },
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
                    name: { kind: 'Name', value: 'ObjectsSearchResultSetPage' },
                  },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'cursor' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'hits' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: '__typename' },
                            },
                            { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'bucket' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'score' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'size' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'modified' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'key' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'version' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'deleted' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'indexedContent' },
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
                            { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'name' } },
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
  containers_Search_gql_NextPageObjectsQuery,
  containers_Search_gql_NextPageObjectsQueryVariables
>

export { containers_Search_gql_NextPageObjectsDocument as default }
