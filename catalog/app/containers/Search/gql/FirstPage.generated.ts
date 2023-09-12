/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../model/graphql/types.generated'

export type containers_Search_gql_FirstPageQueryVariables = Types.Exact<{
  searchString: Types.Maybe<Types.Scalars['String']>
  filter: Types.Maybe<Types.Scalars['SearchFilterExpression']>
  order: Types.Maybe<Types.SearchResultOrder>
}>

export type containers_Search_gql_FirstPageQuery = { readonly __typename: 'Query' } & {
  readonly search:
    | ({ readonly __typename: 'BoundedSearch' } & {
        readonly results: { readonly __typename: 'SearchResultSet' } & {
          readonly firstPage: { readonly __typename: 'SearchResultSetPage' } & Pick<
            Types.SearchResultSetPage,
            'cursor'
          > & {
              readonly hits: ReadonlyArray<
                | ({ readonly __typename: 'SearchHitObject' } & Pick<
                    Types.SearchHitObject,
                    | 'bucket'
                    | 'key'
                    | 'version'
                    | 'score'
                    | 'size'
                    | 'lastModified'
                    | 'deleteMarker'
                  >)
                | ({ readonly __typename: 'SearchHitPackage' } & Pick<
                    Types.SearchHitPackage,
                    | 'bucket'
                    | 'name'
                    | 'hash'
                    | 'score'
                    | 'size'
                    | 'lastModified'
                    | 'comment'
                    | 'meta'
                  >)
              >
            }
        }
      })
    | { readonly __typename: 'UnboundedSearch' }
    | ({ readonly __typename: 'InvalidInput' } & {
        readonly errors: ReadonlyArray<
          { readonly __typename: 'InputError' } & Pick<
            Types.InputError,
            'path' | 'message' | 'name' | 'context'
          >
        >
      })
    | ({ readonly __typename: 'OperationError' } & Pick<
        Types.OperationError,
        'message' | 'name' | 'context'
      >)
}

export const containers_Search_gql_FirstPageDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Search_gql_FirstPage' },
      variableDefinitions: [
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
            name: { kind: 'Name', value: 'SearchFilterExpression' },
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
            name: { kind: 'Name', value: 'search' },
            arguments: [
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
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
                {
                  kind: 'InlineFragment',
                  typeCondition: {
                    kind: 'NamedType',
                    name: { kind: 'Name', value: 'BoundedSearch' },
                  },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'results' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
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
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'cursor' },
                                  },
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
                                        {
                                          kind: 'InlineFragment',
                                          typeCondition: {
                                            kind: 'NamedType',
                                            name: {
                                              kind: 'Name',
                                              value: 'SearchHitObject',
                                            },
                                          },
                                          selectionSet: {
                                            kind: 'SelectionSet',
                                            selections: [
                                              {
                                                kind: 'Field',
                                                name: { kind: 'Name', value: 'bucket' },
                                              },
                                              {
                                                kind: 'Field',
                                                name: { kind: 'Name', value: 'key' },
                                              },
                                              {
                                                kind: 'Field',
                                                name: { kind: 'Name', value: 'version' },
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
                                                name: {
                                                  kind: 'Name',
                                                  value: 'lastModified',
                                                },
                                              },
                                              {
                                                kind: 'Field',
                                                name: {
                                                  kind: 'Name',
                                                  value: 'deleteMarker',
                                                },
                                              },
                                            ],
                                          },
                                        },
                                        {
                                          kind: 'InlineFragment',
                                          typeCondition: {
                                            kind: 'NamedType',
                                            name: {
                                              kind: 'Name',
                                              value: 'SearchHitPackage',
                                            },
                                          },
                                          selectionSet: {
                                            kind: 'SelectionSet',
                                            selections: [
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
                                                name: {
                                                  kind: 'Name',
                                                  value: 'lastModified',
                                                },
                                              },
                                              {
                                                kind: 'Field',
                                                name: { kind: 'Name', value: 'comment' },
                                              },
                                              {
                                                kind: 'Field',
                                                name: { kind: 'Name', value: 'meta' },
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
                      { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
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
  containers_Search_gql_FirstPageQuery,
  containers_Search_gql_FirstPageQueryVariables
>

export { containers_Search_gql_FirstPageDocument as default }
