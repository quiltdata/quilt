/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

import {
  UserResultSelection_User_Fragment,
  UserResultSelection_InvalidInput_Fragment,
  UserResultSelection_OperationError_Fragment,
  UserResultSelectionFragmentDoc,
} from './UserResultSelection.generated'

export type containers_Admin_Users_gql_UserSetEmailMutationVariables = Types.Exact<{
  name: Types.Scalars['String']
  email: Types.Scalars['String']
}>

export type containers_Admin_Users_gql_UserSetEmailMutation = {
  readonly __typename: 'Mutation'
} & {
  readonly admin: { readonly __typename: 'AdminMutations' } & {
    readonly user: { readonly __typename: 'UserAdminMutations' } & {
      readonly mutate: Types.Maybe<
        { readonly __typename: 'MutateUserAdminMutations' } & {
          readonly setEmail:
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

export const containers_Admin_Users_gql_UserSetEmailDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'containers_Admin_Users_gql_UserSetEmail' },
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
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'email' } },
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
                              name: { kind: 'Name', value: 'setEmail' },
                              arguments: [
                                {
                                  kind: 'Argument',
                                  name: { kind: 'Name', value: 'email' },
                                  value: {
                                    kind: 'Variable',
                                    name: { kind: 'Name', value: 'email' },
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
  containers_Admin_Users_gql_UserSetEmailMutation,
  containers_Admin_Users_gql_UserSetEmailMutationVariables
>

export { containers_Admin_Users_gql_UserSetEmailDocument as default }
