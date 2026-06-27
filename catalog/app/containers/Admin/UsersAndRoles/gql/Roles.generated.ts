/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../../model/graphql/types.generated'

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type BucketPermissionLevel = 'READ' | 'READ_WRITE'

export type containers_Admin_UsersAndRoles_gql_RolesQueryVariables = Exact<{
  [key: string]: never
}>

export interface containers_Admin_UsersAndRoles_gql_RolesQuery {
  readonly __typename: 'Query'
  readonly admin: {
    readonly __typename: 'AdminQueries'
    readonly isDefaultRoleSettingDisabled: boolean
  }
  readonly roles: ReadonlyArray<
    | {
        readonly __typename: 'ManagedRole'
        readonly id: string
        readonly name: string
        readonly arn: string
        readonly permissions: ReadonlyArray<{
          readonly __typename: 'RoleBucketPermission'
          readonly level: Types.BucketPermissionLevel
          readonly bucket: { readonly __typename: 'BucketConfig'; readonly name: string }
        }>
        readonly policies: ReadonlyArray<{
          readonly __typename: 'Policy'
          readonly id: string
          readonly title: string
          readonly managed: boolean
          readonly permissions: ReadonlyArray<{
            readonly __typename: 'PolicyBucketPermission'
            readonly level: Types.BucketPermissionLevel
            readonly bucket: {
              readonly __typename: 'BucketConfig'
              readonly name: string
            }
          }>
          readonly roles: ReadonlyArray<{
            readonly __typename: 'ManagedRole'
            readonly id: string
          }>
        }>
      }
    | {
        readonly __typename: 'UnmanagedRole'
        readonly id: string
        readonly name: string
        readonly arn: string
      }
  >
  readonly defaultRole:
    | { readonly __typename: 'ManagedRole'; readonly id: string }
    | { readonly __typename: 'UnmanagedRole'; readonly id: string }
    | null
}

export const containers_Admin_UsersAndRoles_gql_RolesDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Admin_UsersAndRoles_gql_Roles' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'admin' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'isDefaultRoleSettingDisabled' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'roles' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'RoleSelection' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'defaultRole' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
                {
                  kind: 'InlineFragment',
                  typeCondition: {
                    kind: 'NamedType',
                    name: { kind: 'Name', value: 'UnmanagedRole' },
                  },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [{ kind: 'Field', name: { kind: 'Name', value: 'id' } }],
                  },
                },
                {
                  kind: 'InlineFragment',
                  typeCondition: {
                    kind: 'NamedType',
                    name: { kind: 'Name', value: 'ManagedRole' },
                  },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [{ kind: 'Field', name: { kind: 'Name', value: 'id' } }],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'RoleSelection' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Role' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
          {
            kind: 'InlineFragment',
            typeCondition: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'UnmanagedRole' },
            },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'arn' } },
              ],
            },
          },
          {
            kind: 'InlineFragment',
            typeCondition: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'ManagedRole' },
            },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'arn' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'permissions' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'bucket' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                          ],
                        },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'level' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'policies' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'managed' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'permissions' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'bucket' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'name' },
                                  },
                                ],
                              },
                            },
                            { kind: 'Field', name: { kind: 'Name', value: 'level' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'roles' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'id' } },
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
  containers_Admin_UsersAndRoles_gql_RolesQuery,
  containers_Admin_UsersAndRoles_gql_RolesQueryVariables
>

export { containers_Admin_UsersAndRoles_gql_RolesDocument as default }
