/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

import {
  UserResultSelection_User_Fragment,
  UserResultSelection_InvalidInput_Fragment,
  UserResultSelection_OperationError_Fragment,
  UserResultSelectionFragmentDoc,
} from './UserResultSelection.generated'

export type containers_Admin_UsersAndRoles_gql_UserCreateMutationVariables = Types.Exact<{
  input: Types.UserInput
}>

export type containers_Admin_UsersAndRoles_gql_UserCreateMutation = {
  readonly __typename: 'Mutation'
} & {
  readonly admin: { readonly __typename: 'AdminMutations' } & {
    readonly user: { readonly __typename: 'UserAdminMutations' } & {
      readonly create:
        | ({ readonly __typename: 'User' } & UserResultSelection_User_Fragment)
        | ({
            readonly __typename: 'InvalidInput'
          } & UserResultSelection_InvalidInput_Fragment)
        | ({
            readonly __typename: 'OperationError'
          } & UserResultSelection_OperationError_Fragment)
    }
  }
}

export const containers_Admin_UsersAndRoles_gql_UserCreateDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'containers_Admin_UsersAndRoles_gql_UserCreate' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'input' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'UserInput' } },
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
                        name: { kind: 'Name', value: 'create' },
                        arguments: [
                          {
                            kind: 'Argument',
                            name: { kind: 'Name', value: 'input' },
                            value: {
                              kind: 'Variable',
                              name: { kind: 'Name', value: 'input' },
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
    ...UserResultSelectionFragmentDoc.definitions,
  ],
} as unknown as DocumentNode<
  containers_Admin_UsersAndRoles_gql_UserCreateMutation,
  containers_Admin_UsersAndRoles_gql_UserCreateMutationVariables
>

export { containers_Admin_UsersAndRoles_gql_UserCreateDocument as default }
