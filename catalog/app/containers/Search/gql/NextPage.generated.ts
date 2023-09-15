/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../model/graphql/types.generated'

export type containers_Search_gql_NextPageQueryVariables = Types.Exact<{
  after: Types.Scalars['String']
}>

export type containers_Search_gql_NextPageQuery = { readonly __typename: 'Query' } & {
  readonly searchMore:
    | ({ readonly __typename: 'SearchResultSetPage' } & Pick<
        Types.SearchResultSetPage,
        'cursor'
      > & {
          readonly hits: ReadonlyArray<
            | ({ readonly __typename: 'SearchHitObject' } & Pick<
                Types.SearchHitObject,
                | 'id'
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
                | 'id'
                | 'bucket'
                | 'name'
                | 'hash'
                | 'score'
                | 'size'
                | 'lastModified'
                | 'comment'
                | 'meta'
                | 'workflow'
              >)
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
    | ({ readonly __typename: 'OperationError' } & Pick<
        Types.OperationError,
        'message' | 'name' | 'context'
      >)
}

export const containers_Search_gql_NextPageDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Search_gql_NextPage' },
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
            name: { kind: 'Name', value: 'searchMore' },
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
                    name: { kind: 'Name', value: 'SearchResultSetPage' },
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
                            {
                              kind: 'InlineFragment',
                              typeCondition: {
                                kind: 'NamedType',
                                name: { kind: 'Name', value: 'SearchHitObject' },
                              },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'bucket' },
                                  },
                                  { kind: 'Field', name: { kind: 'Name', value: 'key' } },
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
                                    name: { kind: 'Name', value: 'lastModified' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'deleteMarker' },
                                  },
                                ],
                              },
                            },
                            {
                              kind: 'InlineFragment',
                              typeCondition: {
                                kind: 'NamedType',
                                name: { kind: 'Name', value: 'SearchHitPackage' },
                              },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
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
                                    name: { kind: 'Name', value: 'lastModified' },
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
  containers_Search_gql_NextPageQuery,
  containers_Search_gql_NextPageQueryVariables
>

export { containers_Search_gql_NextPageDocument as default }
