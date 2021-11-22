/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type containers_Bucket_PackageRevisions_gql_RevisionListQueryVariables =
  Types.Exact<{
    bucket: Types.Scalars['String']
    name: Types.Scalars['String']
    page: Types.Scalars['Int']
    perPage: Types.Scalars['Int']
  }>

export type containers_Bucket_PackageRevisions_gql_RevisionListQuery = {
  readonly __typename: 'Query'
} & {
  readonly package: Types.Maybe<
    { readonly __typename: 'Package' } & Pick<Types.Package, 'bucket' | 'name'> & {
        readonly revisions: { readonly __typename: 'PackageRevisionList' } & {
          readonly page: ReadonlyArray<
            { readonly __typename: 'PackageRevision' } & Pick<
              Types.PackageRevision,
              'hash' | 'modified' | 'message' | 'userMeta' | 'totalEntries' | 'totalBytes'
            > & {
                readonly accessCounts: Types.Maybe<
                  { readonly __typename: 'AccessCounts' } & Pick<
                    Types.AccessCounts,
                    'total'
                  > & {
                      readonly counts: ReadonlyArray<
                        { readonly __typename: 'AccessCountForDate' } & Pick<
                          Types.AccessCountForDate,
                          'date' | 'value'
                        >
                      >
                    }
                >
              }
          >
        }
      }
  >
}

export const containers_Bucket_PackageRevisions_gql_RevisionListDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {
        kind: 'Name',
        value: 'containers_Bucket_PackageRevisions_gql_RevisionList',
      },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'bucket' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'name' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'page' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'perPage' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'package' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'bucket' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'bucket' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'name' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'name' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'bucket' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'revisions' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'page' },
                        arguments: [
                          {
                            kind: 'Argument',
                            name: { kind: 'Name', value: 'number' },
                            value: {
                              kind: 'Variable',
                              name: { kind: 'Name', value: 'page' },
                            },
                          },
                          {
                            kind: 'Argument',
                            name: { kind: 'Name', value: 'perPage' },
                            value: {
                              kind: 'Variable',
                              name: { kind: 'Name', value: 'perPage' },
                            },
                          },
                        ],
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'hash' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'modified' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'userMeta' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'totalEntries' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'totalBytes' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'accessCounts' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'total' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'counts' },
                                    selectionSet: {
                                      kind: 'SelectionSet',
                                      selections: [
                                        {
                                          kind: 'Field',
                                          name: { kind: 'Name', value: 'date' },
                                        },
                                        {
                                          kind: 'Field',
                                          name: { kind: 'Name', value: 'value' },
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
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  containers_Bucket_PackageRevisions_gql_RevisionListQuery,
  containers_Bucket_PackageRevisions_gql_RevisionListQueryVariables
>

export { containers_Bucket_PackageRevisions_gql_RevisionListDocument as default }
