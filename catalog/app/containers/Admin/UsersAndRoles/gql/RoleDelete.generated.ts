/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../../model/graphql/types.generated'

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type containers_Admin_UsersAndRoles_gql_RoleDeleteMutationVariables = Exact<{
  id: string | number
}>

export interface containers_Admin_UsersAndRoles_gql_RoleDeleteMutation {
  readonly __typename: 'Mutation'
  readonly roleDelete:
    | { readonly __typename: 'RoleAssigned' }
    | { readonly __typename: 'RoleDeleteSuccess' }
    | { readonly __typename: 'RoleDoesNotExist' }
    | { readonly __typename: 'RoleNameReserved' }
    | { readonly __typename: 'RoleNameUsedBySsoConfig' }
}

export const containers_Admin_UsersAndRoles_gql_RoleDeleteDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'containers_Admin_UsersAndRoles_gql_RoleDelete' },
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
            name: { kind: 'Name', value: 'roleDelete' },
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
                { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  containers_Admin_UsersAndRoles_gql_RoleDeleteMutation,
  containers_Admin_UsersAndRoles_gql_RoleDeleteMutationVariables
>

export { containers_Admin_UsersAndRoles_gql_RoleDeleteDocument as default }
