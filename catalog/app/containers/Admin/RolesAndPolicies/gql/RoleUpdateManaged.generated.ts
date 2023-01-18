/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

import {
  RoleSelection_ManagedRole_Fragment,
  RoleSelection_UnmanagedRole_Fragment,
  RoleSelectionFragmentDoc,
} from './RoleSelection.generated'

export type containers_Admin_RolesAndPolicies_gql_RoleUpdateManagedMutationVariables =
  Types.Exact<{
    id: Types.Scalars['ID']
    input: Types.ManagedRoleInput
  }>

export type containers_Admin_RolesAndPolicies_gql_RoleUpdateManagedMutation = {
  readonly __typename: 'Mutation'
} & {
  readonly roleUpdate:
    | { readonly __typename: 'RoleHasTooManyPoliciesToAttach' }
    | { readonly __typename: 'RoleIsManaged' }
    | { readonly __typename: 'RoleIsUnmanaged' }
    | { readonly __typename: 'RoleNameExists' }
    | { readonly __typename: 'RoleNameInvalid' }
    | { readonly __typename: 'RoleNameReserved' }
    | ({ readonly __typename: 'RoleUpdateSuccess' } & {
        readonly role:
          | ({ readonly __typename: 'ManagedRole' } & RoleSelection_ManagedRole_Fragment)
          | ({
              readonly __typename: 'UnmanagedRole'
            } & RoleSelection_UnmanagedRole_Fragment)
      })
}

export const containers_Admin_RolesAndPolicies_gql_RoleUpdateManagedDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {
        kind: 'Name',
        value: 'containers_Admin_RolesAndPolicies_gql_RoleUpdateManaged',
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
    ...RoleSelectionFragmentDoc.definitions,
  ],
} as unknown as DocumentNode<
  containers_Admin_RolesAndPolicies_gql_RoleUpdateManagedMutation,
  containers_Admin_RolesAndPolicies_gql_RoleUpdateManagedMutationVariables
>

export { containers_Admin_RolesAndPolicies_gql_RoleUpdateManagedDocument as default }
