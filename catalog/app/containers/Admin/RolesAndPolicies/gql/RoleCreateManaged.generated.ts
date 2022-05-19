/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

import {
  RoleSelection_UnmanagedRole_Fragment,
  RoleSelection_ManagedRole_Fragment,
  RoleSelectionFragmentDoc,
} from './RoleSelection.generated'

export type containers_Admin_RolesAndPolicies_gql_RoleCreateManagedMutationVariables =
  Types.Exact<{
    input: Types.ManagedRoleInput
  }>

export type containers_Admin_RolesAndPolicies_gql_RoleCreateManagedMutation = {
  readonly __typename: 'Mutation'
} & {
  readonly roleCreate:
    | ({ readonly __typename: 'RoleCreateSuccess' } & {
        readonly role:
          | ({
              readonly __typename: 'UnmanagedRole'
            } & RoleSelection_UnmanagedRole_Fragment)
          | ({ readonly __typename: 'ManagedRole' } & RoleSelection_ManagedRole_Fragment)
      })
    | { readonly __typename: 'RoleNameReserved' }
    | { readonly __typename: 'RoleNameExists' }
    | { readonly __typename: 'RoleNameInvalid' }
    | { readonly __typename: 'RoleHasTooManyPoliciesToAttach' }
}

export const containers_Admin_RolesAndPolicies_gql_RoleCreateManagedDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {
        kind: 'Name',
        value: 'containers_Admin_RolesAndPolicies_gql_RoleCreateManaged',
      },
      variableDefinitions: [
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
            alias: { kind: 'Name', value: 'roleCreate' },
            name: { kind: 'Name', value: 'roleCreateManaged' },
            arguments: [
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
                    name: { kind: 'Name', value: 'RoleCreateSuccess' },
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
    ...RoleSelectionFragmentDoc.definitions,
  ],
} as unknown as DocumentNode<
  containers_Admin_RolesAndPolicies_gql_RoleCreateManagedMutation,
  containers_Admin_RolesAndPolicies_gql_RoleCreateManagedMutationVariables
>

export { containers_Admin_RolesAndPolicies_gql_RoleCreateManagedDocument as default }
