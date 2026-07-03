/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../model/graphql/types.generated'

import type { JsonRecord } from 'utils/types'
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type containers_DataProduct_gql_DataProductQueryVariables = Exact<{
  id: string | number
}>

export interface containers_DataProduct_gql_DataProductQuery {
  readonly __typename: 'Query'
  readonly dataProduct: {
    readonly __typename: 'DataProduct'
    readonly id: string
    readonly name: string
    readonly title: string | null
    readonly description: string | null
    readonly createdAt: Date
    readonly ownerRole:
      | { readonly __typename: 'ManagedRole'; readonly name: string }
      | { readonly __typename: 'UnmanagedRole'; readonly name: string }
    readonly members: {
      readonly __typename: 'DataProductMembers'
      readonly objects: ReadonlyArray<{
        readonly __typename: 'DataProductObjectMember'
        readonly logicalKey: string
        readonly bucket: string
        readonly key: string
        readonly versionId: string | null
      }>
      readonly packages: ReadonlyArray<{
        readonly __typename: 'DataProductPackageMember'
        readonly virtualName: string
        readonly bucket: string
        readonly name: string
        readonly hashOrTag: string | null
        readonly package: {
          readonly __typename: 'Package'
          readonly modified: Date
          readonly revisions: {
            readonly __typename: 'PackageRevisionList'
            readonly total: number
          }
          readonly revision: {
            readonly __typename: 'PackageRevision'
            readonly hash: string
            readonly modified: Date
            readonly message: string | null
            readonly totalEntries: number | null
            readonly totalBytes: number | null
            readonly userMeta: JsonRecord | null
            readonly workflow: {
              readonly __typename: 'PackageWorkflow'
              readonly id: string | null
            } | null
          } | null
        } | null
      }>
    }
  } | null
}

export const containers_DataProduct_gql_DataProductDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_DataProduct_gql_DataProduct' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'dataProduct' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                { kind: 'Field', name: { kind: 'Name', value: 'description' } },
                { kind: 'Field', name: { kind: 'Name', value: 'createdAt' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'ownerRole' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
                      {
                        kind: 'InlineFragment',
                        typeCondition: {
                          kind: 'NamedType',
                          name: { kind: 'Name', value: 'ManagedRole' },
                        },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                          ],
                        },
                      },
                      {
                        kind: 'InlineFragment',
                        typeCondition: {
                          kind: 'NamedType',
                          name: { kind: 'Name', value: 'UnmanagedRole' },
                        },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'members' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'objects' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'logicalKey' },
                            },
                            { kind: 'Field', name: { kind: 'Name', value: 'bucket' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'key' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'versionId' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'packages' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'virtualName' },
                            },
                            { kind: 'Field', name: { kind: 'Name', value: 'bucket' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'hashOrTag' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'package' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'modified' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'revisions' },
                                    selectionSet: {
                                      kind: 'SelectionSet',
                                      selections: [
                                        {
                                          kind: 'Field',
                                          name: { kind: 'Name', value: 'total' },
                                        },
                                      ],
                                    },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'revision' },
                                    selectionSet: {
                                      kind: 'SelectionSet',
                                      selections: [
                                        {
                                          kind: 'Field',
                                          name: { kind: 'Name', value: 'hash' },
                                        },
                                        {
                                          kind: 'Field',
                                          name: { kind: 'Name', value: 'modified' },
                                        },
                                        {
                                          kind: 'Field',
                                          name: { kind: 'Name', value: 'message' },
                                        },
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
                                          name: { kind: 'Name', value: 'userMeta' },
                                        },
                                        {
                                          kind: 'Field',
                                          name: { kind: 'Name', value: 'workflow' },
                                          selectionSet: {
                                            kind: 'SelectionSet',
                                            selections: [
                                              {
                                                kind: 'Field',
                                                name: { kind: 'Name', value: 'id' },
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
      },
    },
  ],
} as unknown as DocumentNode<
  containers_DataProduct_gql_DataProductQuery,
  containers_DataProduct_gql_DataProductQueryVariables
>

export { containers_DataProduct_gql_DataProductDocument as default }
