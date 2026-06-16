/* eslint-disable @typescript-eslint/naming-convention */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import type { JsonRecord } from 'utils/types'
import * as Types from '../../../model/graphql/types.generated'

export interface BooleanSearchPredicate {
  readonly false: boolean | null | undefined
  readonly true: boolean | null | undefined
}

export interface DatetimeSearchPredicate {
  readonly gte: Date | null | undefined
  readonly lte: Date | null | undefined
}

export interface KeywordSearchPredicate {
  readonly terms: Array<string> | null | undefined
  readonly wildcard: string | null | undefined
}

export interface NumberSearchPredicate {
  readonly gte: number | null | undefined
  readonly lte: number | null | undefined
}

export interface PackageUserMetaPredicate {
  readonly boolean: BooleanSearchPredicate | null | undefined
  readonly datetime: DatetimeSearchPredicate | null | undefined
  readonly keyword: KeywordSearchPredicate | null | undefined
  readonly number: NumberSearchPredicate | null | undefined
  readonly path: string
  readonly text: TextSearchPredicate | null | undefined
}

export interface PackagesSearchFilter {
  readonly comment: TextSearchPredicate | null | undefined
  readonly entries: NumberSearchPredicate | null | undefined
  readonly hash: KeywordSearchPredicate | null | undefined
  readonly modified: DatetimeSearchPredicate | null | undefined
  readonly name: KeywordSearchPredicate | null | undefined
  readonly size: NumberSearchPredicate | null | undefined
  readonly workflow: KeywordSearchPredicate | null | undefined
}

export type SearchResultOrder =
  | 'BEST_MATCH'
  | 'LEX_ASC'
  | 'LEX_DESC'
  | 'NEWEST'
  | 'OLDEST'

export interface TextSearchPredicate {
  readonly queryString: string
}

export type containers_Search_gql_FirstPagePackagesQueryVariables = Exact<{
  buckets: ReadonlyArray<string> | null | undefined
  searchString: string | null | undefined
  filter: Types.PackagesSearchFilter | null | undefined
  userMetaFilters: ReadonlyArray<Types.PackageUserMetaPredicate> | null | undefined
  latestOnly: boolean
  order: Types.SearchResultOrder | null | undefined
}>

export interface containers_Search_gql_FirstPagePackagesQuery {
  readonly __typename: 'Query'
  readonly searchPackages:
    | { readonly __typename: 'EmptySearchResultSet' }
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
        readonly __typename: 'PackagesSearchResultSet'
        readonly total: number
        readonly firstPage: {
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
}

export const containers_Search_gql_FirstPagePackagesDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Search_gql_FirstPagePackages' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'buckets' } },
          type: {
            kind: 'ListType',
            type: {
              kind: 'NonNullType',
              type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
            },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'searchString' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
          type: {
            kind: 'NamedType',
            name: { kind: 'Name', value: 'PackagesSearchFilter' },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'userMetaFilters' },
          },
          type: {
            kind: 'ListType',
            type: {
              kind: 'NonNullType',
              type: {
                kind: 'NamedType',
                name: { kind: 'Name', value: 'PackageUserMetaPredicate' },
              },
            },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'latestOnly' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'order' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'SearchResultOrder' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'searchPackages' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'buckets' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'buckets' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'searchString' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'searchString' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'filter' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'userMetaFilters' },
                value: {
                  kind: 'Variable',
                  name: { kind: 'Name', value: 'userMetaFilters' },
                },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'latestOnly' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'latestOnly' } },
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
                    name: { kind: 'Name', value: 'PackagesSearchResultSet' },
                  },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'total' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'firstPage' },
                        arguments: [
                          {
                            kind: 'Argument',
                            name: { kind: 'Name', value: 'order' },
                            value: {
                              kind: 'Variable',
                              name: { kind: 'Name', value: 'order' },
                            },
                          },
                        ],
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
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'bucket' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'name' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'pointer' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'hash' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'score' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'size' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'modified' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'totalEntriesCount' },
                                  },
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
                                    name: { kind: 'Name', value: 'workflow' },
                                  },
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
                                                name: {
                                                  kind: 'Name',
                                                  value: 'logicalKey',
                                                },
                                              },
                                              {
                                                kind: 'Field',
                                                name: { kind: 'Name', value: 'meta' },
                                              },
                                              {
                                                kind: 'Field',
                                                name: {
                                                  kind: 'Name',
                                                  value: 'physicalKey',
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
  containers_Search_gql_FirstPagePackagesQuery,
  containers_Search_gql_FirstPagePackagesQueryVariables
>

export { containers_Search_gql_FirstPagePackagesDocument as default }
