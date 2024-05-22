/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

import {
  UserResultSelection_User_Fragment,
  UserResultSelection_InvalidInput_Fragment,
  UserResultSelection_OperationError_Fragment,
  UserResultSelectionFragmentDoc,
} from './UserResultSelection.generated'

export type containers_Admin_Users_gql_UserSetActiveMutationVariables = Types.Exact<{
  name: Types.Scalars['String']
  active: Types.Scalars['Boolean']
}>

export type containers_Admin_Users_gql_UserSetActiveMutation = {
  readonly __typename: 'Mutation'
} & {
  readonly admin: { readonly __typename: 'AdminMutations' } & {
    readonly user: { readonly __typename: 'UserAdminMutations' } & {
      readonly mutate: Types.Maybe<
        { readonly __typename: 'MutateUserAdminMutations' } & {
          readonly setActive:
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

export const containers_Admin_Users_gql_UserSetActiveDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'containers_Admin_Users_gql_UserSetActive' },
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
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'active' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
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
                              name: { kind: 'Name', value: 'setActive' },
                              arguments: [
                                {
                                  kind: 'Argument',
                                  name: { kind: 'Name', value: 'active' },
                                  value: {
                                    kind: 'Variable',
                                    name: { kind: 'Name', value: 'active' },
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
  containers_Admin_Users_gql_UserSetActiveMutation,
  containers_Admin_Users_gql_UserSetActiveMutationVariables
>

export { containers_Admin_Users_gql_UserSetActiveDocument as default }
