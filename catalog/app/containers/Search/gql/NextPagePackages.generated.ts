/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../model/graphql/types.generated'

export type containers_Search_gql_NextPagePackagesQueryVariables = Types.Exact<{
  after: Types.Scalars['String']
}>

export type containers_Search_gql_NextPagePackagesQuery = {
  readonly __typename: 'Query'
} & {
  readonly searchMorePackages:
    | ({ readonly __typename: 'PackagesSearchResultSetPage' } & Pick<
        Types.PackagesSearchResultSetPage,
        'cursor'
      > & {
          readonly hits: ReadonlyArray<
            { readonly __typename: 'SearchHitPackage' } & Pick<
              Types.SearchHitPackage,
              | 'id'
              | 'bucket'
              | 'name'
              | 'pointer'
              | 'hash'
              | 'score'
              | 'size'
              | 'modified'
              | 'totalEntriesCount'
              | 'comment'
              | 'meta'
              | 'workflow'
            > & {
                readonly matchLocations: {
                  readonly __typename: 'SearchHitPackageMatchLocations'
                } & Pick<
                  Types.SearchHitPackageMatchLocations,
                  'comment' | 'meta' | 'name' | 'workflow'
                >
                readonly matchingEntries: ReadonlyArray<
                  { readonly __typename: 'SearchHitPackageMatchingEntry' } & Pick<
                    Types.SearchHitPackageMatchingEntry,
                    'logicalKey' | 'physicalKey' | 'size' | 'meta'
                  > & {
                      readonly matchLocations: {
                        readonly __typename: 'SearchHitPackageEntryMatchLocations'
                      } & Pick<
                        Types.SearchHitPackageEntryMatchLocations,
                        'contents' | 'logicalKey' | 'meta' | 'physicalKey'
                      >
                    }
                >
              }
          >
        })
    | ({ readonly __typename: 'InvalidInput' } & {
        readonly errors: ReadonlyArray<
          { readonly __typename: 'InputError' } & Pick<
            Types.InputError,
            'path' | 'message' | 'name' | 'context'
          >
        >
      })
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
