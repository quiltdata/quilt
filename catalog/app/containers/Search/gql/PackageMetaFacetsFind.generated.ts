/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../model/graphql/types.generated'

export type containers_Search_gql_PackageMetaFacetsFindQueryVariables = Types.Exact<{
  buckets: Types.Maybe<ReadonlyArray<Types.Scalars['String']>>
  searchString: Types.Maybe<Types.Scalars['String']>
  filter: Types.Maybe<Types.PackagesSearchFilter>
  find: Types.Scalars['String']
}>

export type containers_Search_gql_PackageMetaFacetsFindQuery = {
  readonly __typename: 'Query'
} & {
  readonly searchPackages:
    | ({ readonly __typename: 'PackagesSearchResultSet' } & {
        readonly filteredUserMetaFacets: ReadonlyArray<
          | ({ readonly __typename: 'NumberPackageUserMetaFacet' } & Pick<
              Types.NumberPackageUserMetaFacet,
              'path'
            > & {
                readonly numberExtents: { readonly __typename: 'NumberExtents' } & Pick<
                  Types.NumberExtents,
                  'min' | 'max'
                >
              })
          | ({ readonly __typename: 'DatetimePackageUserMetaFacet' } & Pick<
              Types.DatetimePackageUserMetaFacet,
              'path'
            > & {
                readonly datetimeExtents: {
                  readonly __typename: 'DatetimeExtents'
                } & Pick<Types.DatetimeExtents, 'min' | 'max'>
              })
          | ({ readonly __typename: 'KeywordPackageUserMetaFacet' } & Pick<
              Types.KeywordPackageUserMetaFacet,
              'path'
            > & {
                readonly extents: { readonly __typename: 'KeywordExtents' } & Pick<
                  Types.KeywordExtents,
                  'values'
                >
              })
          | ({ readonly __typename: 'TextPackageUserMetaFacet' } & Pick<
              Types.TextPackageUserMetaFacet,
              'path'
            >)
          | ({ readonly __typename: 'BooleanPackageUserMetaFacet' } & Pick<
              Types.BooleanPackageUserMetaFacet,
              'path'
            >)
        >
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
}

export const containers_Search_gql_PackageMetaFacetsFindDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Search_gql_PackageMetaFacetsFind' },
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
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'find' } },
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
                        name: { kind: 'Name', value: 'filteredUserMetaFacets' },
                        arguments: [
                          {
                            kind: 'Argument',
                            name: { kind: 'Name', value: 'filter' },
                            value: {
                              kind: 'Variable',
                              name: { kind: 'Name', value: 'find' },
                            },
                          },
                        ],
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
                                name: { kind: 'Name', value: 'IPackageUserMetaFacet' },
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
                            {
                              kind: 'InlineFragment',
                              typeCondition: {
                                kind: 'NamedType',
                                name: {
                                  kind: 'Name',
                                  value: 'NumberPackageUserMetaFacet',
                                },
                              },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'Field',
                                    alias: { kind: 'Name', value: 'numberExtents' },
                                    name: { kind: 'Name', value: 'extents' },
                                    selectionSet: {
                                      kind: 'SelectionSet',
                                      selections: [
                                        {
                                          kind: 'Field',
                                          name: { kind: 'Name', value: 'min' },
                                        },
                                        {
                                          kind: 'Field',
                                          name: { kind: 'Name', value: 'max' },
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
                                name: {
                                  kind: 'Name',
                                  value: 'DatetimePackageUserMetaFacet',
                                },
                              },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'Field',
                                    alias: { kind: 'Name', value: 'datetimeExtents' },
                                    name: { kind: 'Name', value: 'extents' },
                                    selectionSet: {
                                      kind: 'SelectionSet',
                                      selections: [
                                        {
                                          kind: 'Field',
                                          name: { kind: 'Name', value: 'min' },
                                        },
                                        {
                                          kind: 'Field',
                                          name: { kind: 'Name', value: 'max' },
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
                                name: {
                                  kind: 'Name',
                                  value: 'KeywordPackageUserMetaFacet',
                                },
                              },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'extents' },
                                    selectionSet: {
                                      kind: 'SelectionSet',
                                      selections: [
                                        {
                                          kind: 'Field',
                                          name: { kind: 'Name', value: 'values' },
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
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  containers_Search_gql_PackageMetaFacetsFindQuery,
  containers_Search_gql_PackageMetaFacetsFindQueryVariables
>

export { containers_Search_gql_PackageMetaFacetsFindDocument as default }
