/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../../model/graphql/types.generated'

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type BucketPermissionLevel = 'READ' | 'READ_WRITE'

export interface ManagedRoleInput {
  readonly name: string
  readonly policies: Array<string | number>
}

export type containers_Admin_UsersAndRoles_gql_RoleUpdateManagedMutationVariables =
  Exact<{
    id: string | number
    input: Types.ManagedRoleInput
  }>

export interface containers_Admin_UsersAndRoles_gql_RoleUpdateManagedMutation {
  readonly __typename: 'Mutation'
  readonly roleUpdate:
    | { readonly __typename: 'RoleHasTooManyPoliciesToAttach' }
    | { readonly __typename: 'RoleIsManaged' }
    | { readonly __typename: 'RoleIsUnmanaged' }
    | { readonly __typename: 'RoleNameExists' }
    | { readonly __typename: 'RoleNameInvalid' }
    | { readonly __typename: 'RoleNameReserved' }
    | { readonly __typename: 'RoleNameUsedBySsoConfig' }
    | {
        readonly __typename: 'RoleUpdateSuccess'
        readonly role:
          | {
              readonly __typename: 'ManagedRole'
              readonly id: string
              readonly name: string
              readonly arn: string
              readonly permissions: ReadonlyArray<{
                readonly __typename: 'RoleBucketPermission'
                readonly level: Types.BucketPermissionLevel
                readonly bucket: {
                  readonly __typename: 'BucketConfig'
                  readonly name: string
                }
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
      }
}

export const containers_Admin_UsersAndRoles_gql_RoleUpdateManagedDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {
        kind: 'Name',
        value: 'containers_Admin_UsersAndRoles_gql_RoleUpdateManaged',
      },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'input' } },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'ManagedRoleInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            alias: { kind: 'Name', value: 'roleUpdate' },
            name: { kind: 'Name', value: 'roleUpdateManaged' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'input' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'InlineFragment',
                  typeCondition: {
                    kind: 'NamedType',
                    name: { kind: 'Name', value: 'RoleUpdateSuccess' },
                  },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'role' },
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
  containers_Admin_UsersAndRoles_gql_RoleUpdateManagedMutation,
  containers_Admin_UsersAndRoles_gql_RoleUpdateManagedMutationVariables
>

export { containers_Admin_UsersAndRoles_gql_RoleUpdateManagedDocument as default }
