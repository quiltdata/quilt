/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

import {
  UserResultSelection_User_Fragment,
  UserResultSelection_InvalidInput_Fragment,
  UserResultSelection_OperationError_Fragment,
  UserResultSelectionFragmentDoc,
} from './UserResultSelection.generated'

export type containers_Admin_Users_gql_UserSetRoleMutationVariables = Types.Exact<{
  name: Types.Scalars['String']
  role: Types.Scalars['String']
  extraRoles: ReadonlyArray<Types.Scalars['String']>
}>

export type containers_Admin_Users_gql_UserSetRoleMutation = {
  readonly __typename: 'Mutation'
} & {
  readonly admin: { readonly __typename: 'AdminMutations' } & {
    readonly user: { readonly __typename: 'UserAdminMutations' } & {
      readonly mutate: Types.Maybe<
        { readonly __typename: 'MutateUserAdminMutations' } & {
          readonly setRole:
            | ({ readonly __typename: 'User' } & UserResultSelection_User_Fragment)
            | ({
                readonly __typename: 'InvalidInput'
              } & UserResultSelection_InvalidInput_Fragment)
            | ({
                readonly __typename: 'OperationError'
              } & UserResultSelection_OperationError_Fragment)
        }
      >
    }
  }
}

export const containers_Admin_Users_gql_UserSetRoleDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'containers_Admin_Users_gql_UserSetRole' },
      variableDefinitions: [
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
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'role' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'extraRoles' } },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'ListType',
              type: {
                kind: 'NonNullType',
                type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
              },
            },
          },
        },
      ],
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
                  name: { kind: 'Name', value: 'user' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'mutate' },
                        arguments: [
                          {
                            kind: 'Argument',
                            name: { kind: 'Name', value: 'name' },
                            value: {
                              kind: 'Variable',
                              name: { kind: 'Name', value: 'name' },
                            },
                          },
                        ],
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'setRole' },
                              arguments: [
                                {
                                  kind: 'Argument',
                                  name: { kind: 'Name', value: 'role' },
                                  value: {
                                    kind: 'Variable',
                                    name: { kind: 'Name', value: 'role' },
                                  },
                                },
                                {
                                  kind: 'Argument',
                                  name: { kind: 'Name', value: 'extraRoles' },
                                  value: {
                                    kind: 'Variable',
                                    name: { kind: 'Name', value: 'extraRoles' },
                                  },
                                },
                              ],
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'FragmentSpread',
                                    name: { kind: 'Name', value: 'UserResultSelection' },
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
    ...UserResultSelectionFragmentDoc.definitions,
  ],
} as unknown as DocumentNode<
  containers_Admin_Users_gql_UserSetRoleMutation,
  containers_Admin_Users_gql_UserSetRoleMutationVariables
>

export { containers_Admin_Users_gql_UserSetRoleDocument as default }
