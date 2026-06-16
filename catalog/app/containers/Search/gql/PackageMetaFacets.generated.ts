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

export interface PackagesSearchFilter {
  readonly comment: TextSearchPredicate | null | undefined
  readonly entries: NumberSearchPredicate | null | undefined
  readonly hash: KeywordSearchPredicate | null | undefined
  readonly modified: DatetimeSearchPredicate | null | undefined
  readonly name: KeywordSearchPredicate | null | undefined
  readonly size: NumberSearchPredicate | null | undefined
  readonly workflow: KeywordSearchPredicate | null | undefined
}

export interface TextSearchPredicate {
  readonly queryString: string
}

export type containers_Search_gql_PackageMetaFacetsQueryVariables = Exact<{
  buckets: ReadonlyArray<string> | null | undefined
  searchString: string | null | undefined
  filter: Types.PackagesSearchFilter | null | undefined
  latestOnly: boolean
}>

export interface containers_Search_gql_PackageMetaFacetsQuery {
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
        readonly stats: {
          readonly __typename: 'PackagesSearchStats'
          readonly userMetaTruncated: boolean
          readonly userMeta: ReadonlyArray<
            | {
                readonly __typename: 'BooleanPackageUserMetaFacet'
                readonly path: string
              }
            | {
                readonly __typename: 'DatetimePackageUserMetaFacet'
                readonly path: string
              }
            | {
                readonly __typename: 'KeywordPackageUserMetaFacet'
                readonly path: string
              }
            | { readonly __typename: 'NumberPackageUserMetaFacet'; readonly path: string }
            | { readonly __typename: 'TextPackageUserMetaFacet'; readonly path: string }
          >
        }
      }
}

export const containers_Search_gql_PackageMetaFacetsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Search_gql_PackageMetaFacets' },
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
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'latestOnly' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
          },
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
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'stats' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'userMetaTruncated' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'userMeta' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: '__typename' },
                                  },
                                  {
                                    kind: 'InlineFragment',
                                    typeCondition: {
                                      kind: 'NamedType',
                                      name: {
                                        kind: 'Name',
                                        value: 'IPackageUserMetaFacet',
                                      },
                                    },
                                    selectionSet: {
                                      kind: 'SelectionSet',
                                      selections: [
                                        {
                                          kind: 'Field',
                                          name: { kind: 'Name', value: 'path' },
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
  containers_Search_gql_PackageMetaFacetsQuery,
  containers_Search_gql_PackageMetaFacetsQueryVariables
>

export { containers_Search_gql_PackageMetaFacetsDocument as default }
