/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import type { JsonRecord } from 'utils/types'
import * as Types from '../../../model/graphql/types.generated'

export type containers_Search_gql_NextPagePackagesQueryVariables = Exact<{
  after: string
}>

export interface containers_Search_gql_NextPagePackagesQuery {
  readonly __typename: 'Query'
  readonly searchMorePackages:
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
        readonly __typename: 'OperationError'
        readonly name: string
        readonly message: string
        readonly context: JsonRecord | null
      }
    | {
        readonly __typename: 'PackagesSearchResultSetPage'
        readonly cursor: string | null
        readonly hits: ReadonlyArray<{
          readonly __typename: 'SearchHitPackage'
          readonly id: string
          readonly bucket: string
          readonly name: string
          readonly pointer: string
          readonly hash: string
          readonly score: number
          readonly size: number
          readonly modified: Date
          readonly totalEntriesCount: number
          readonly comment: string | null
          readonly meta: string | null
          readonly workflow: JsonRecord | null
          readonly matchLocations: {
            readonly __typename: 'SearchHitPackageMatchLocations'
            readonly comment: boolean
            readonly meta: boolean
            readonly name: boolean
            readonly workflow: boolean
          }
          readonly matchingEntries: ReadonlyArray<{
            readonly __typename: 'SearchHitPackageMatchingEntry'
            readonly logicalKey: string
            readonly physicalKey: string
            readonly size: number
            readonly meta: string | null
            readonly matchLocations: {
              readonly __typename: 'SearchHitPackageEntryMatchLocations'
              readonly contents: boolean
              readonly logicalKey: boolean
              readonly meta: boolean
              readonly physicalKey: boolean
            }
          }>
        }>
      }
}

export const containers_Search_gql_NextPagePackagesDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Search_gql_NextPagePackages' },
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
            name: { kind: 'Name', value: 'searchMorePackages' },
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
                    name: { kind: 'Name', value: 'PackagesSearchResultSetPage' },
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
                            { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'pointer' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'hash' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'score' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'size' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'modified' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'totalEntriesCount' },
                            },
                            { kind: 'Field', name: { kind: 'Name', value: 'comment' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'meta' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'workflow' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'matchLocations' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'comment' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'meta' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'name' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'workflow' },
                                  },
                                ],
                              },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'matchingEntries' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'logicalKey' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'physicalKey' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'size' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'meta' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'matchLocations' },
                                    selectionSet: {
                                      kind: 'SelectionSet',
                                      selections: [
                                        {
                                          kind: 'Field',
                                          name: { kind: 'Name', value: 'contents' },
                                        },
                                        {
                                          kind: 'Field',
                                          name: { kind: 'Name', value: 'logicalKey' },
                                        },
                                        {
                                          kind: 'Field',
                                          name: { kind: 'Name', value: 'meta' },
                                        },
                                        {
                                          kind: 'Field',
                                          name: { kind: 'Name', value: 'physicalKey' },
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
  containers_Search_gql_NextPagePackagesQuery,
  containers_Search_gql_NextPagePackagesQueryVariables
>

export { containers_Search_gql_NextPagePackagesDocument as default }
