/* eslint-disable @typescript-eslint/naming-convention */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import type { JsonRecord } from 'utils/types'
import * as Types from '../../../../model/graphql/types.generated'

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

export type containers_Bucket_Workflows_gql_WorkflowPackagesQueryVariables = Exact<{
  buckets: ReadonlyArray<string>
  filter: Types.PackagesSearchFilter
}>

export interface containers_Bucket_Workflows_gql_WorkflowPackagesQuery {
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
          readonly hits: ReadonlyArray<{
            readonly __typename: 'SearchHitPackage'
            readonly id: string
            readonly bucket: string
            readonly size: number
            readonly modified: Date
            readonly name: string
            readonly hash: string
            readonly comment: string | null
            readonly meta: string | null
            readonly workflow: JsonRecord | null
          }>
        }
      }
}

export const containers_Bucket_Workflows_gql_WorkflowPackagesDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Bucket_Workflows_gql_WorkflowPackages' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'buckets' } },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'ListType',
              type: {
                kind: 'NonNullType',
                type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
              },
            },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'PackagesSearchFilter' },
            },
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
                name: { kind: 'Name', value: 'filter' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'latestOnly' },
                value: { kind: 'BooleanValue', value: true },
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
                            name: { kind: 'Name', value: 'size' },
                            value: { kind: 'IntValue', value: '6' },
                          },
                          {
                            kind: 'Argument',
                            name: { kind: 'Name', value: 'order' },
                            value: { kind: 'EnumValue', value: 'NEWEST' },
                          },
                        ],
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
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
                                    name: { kind: 'Name', value: 'size' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'modified' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'name' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'hash' },
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
  containers_Bucket_Workflows_gql_WorkflowPackagesQuery,
  containers_Bucket_Workflows_gql_WorkflowPackagesQueryVariables
>

export { containers_Bucket_Workflows_gql_WorkflowPackagesDocument as default }
