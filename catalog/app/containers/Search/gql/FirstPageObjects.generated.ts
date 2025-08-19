/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../model/graphql/types.generated'

export type containers_Search_gql_FirstPageObjectsQueryVariables = Types.Exact<{
  buckets: Types.Maybe<ReadonlyArray<Types.Scalars['String']>>
  searchString: Types.Maybe<Types.Scalars['String']>
  filter: Types.Maybe<Types.ObjectsSearchFilter>
  order: Types.Maybe<Types.SearchResultOrder>
}>

export type containers_Search_gql_FirstPageObjectsQuery = {
  readonly __typename: 'Query'
} & {
  readonly searchObjects:
    | ({ readonly __typename: 'ObjectsSearchResultSet' } & Pick<
        Types.ObjectsSearchResultSet,
        'total'
      > & {
          readonly firstPage: {
            readonly __typename: 'ObjectsSearchResultSetPage'
          } & Pick<Types.ObjectsSearchResultSetPage, 'cursor'> & {
              readonly hits: ReadonlyArray<
                { readonly __typename: 'SearchHitObject' } & Pick<
                  Types.SearchHitObject,
                  | 'id'
                  | 'bucket'
                  | 'score'
                  | 'size'
                  | 'modified'
                  | 'key'
                  | 'version'
                  | 'deleted'
                  | 'indexedContent'
                >
              >
            }
        })
    | { readonly __typename: 'EmptySearchResultSet' }
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
        'name' | 'message' | 'context'
      >)
}

export const containers_Search_gql_FirstPageObjectsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Search_gql_FirstPageObjects' },
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
            name: { kind: 'Name', value: 'ObjectsSearchFilter' },
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
            name: { kind: 'Name', value: 'searchObjects' },
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
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
                {
                  kind: 'InlineFragment',
                  typeCondition: {
                    kind: 'NamedType',
                    name: { kind: 'Name', value: 'ObjectsSearchResultSet' },
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
                                  { kind: 'Field', name: { kind: 'Name', value: 'key' } },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'version' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'deleted' },
                                  },
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
  containers_Search_gql_FirstPageObjectsQuery,
  containers_Search_gql_FirstPageObjectsQueryVariables
>

export { containers_Search_gql_FirstPageObjectsDocument as default }
