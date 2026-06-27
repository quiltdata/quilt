/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../../model/graphql/types.generated'

import type { JsonRecord } from 'utils/types'
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type containers_Admin_UsersAndRoles_gql_UserDeleteMutationVariables = Exact<{
  name: string
}>

export interface containers_Admin_UsersAndRoles_gql_UserDeleteMutation {
  readonly __typename: 'Mutation'
  readonly admin: {
    readonly __typename: 'AdminMutations'
    readonly user: {
      readonly __typename: 'UserAdminMutations'
      readonly mutate: {
        readonly __typename: 'MutateUserAdminMutations'
        readonly delete:
          | {
              readonly __typename: 'InvalidInput'
              readonly errors: ReadonlyArray<{
                readonly __typename: 'InputError'
                readonly path: string | null
                readonly message: string
                readonly name: string
                readonly context: JsonRecord | null
              }>
            }
          | { readonly __typename: 'Ok' }
          | {
              readonly __typename: 'OperationError'
              readonly message: string
              readonly name: string
              readonly context: JsonRecord | null
            }
      } | null
    }
  }
}

export const containers_Admin_UsersAndRoles_gql_UserDeleteDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'containers_Admin_UsersAndRoles_gql_UserDelete' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'name' } },
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
                              name: { kind: 'Name', value: 'delete' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: '__typename' },
                                  },
                                  {
                                    kind: 'InlineFragment',
                                    typeCondition: {
                                      kind: 'NamedType',
                                      name: { kind: 'Name', value: 'InvalidInput' },
                                    },
                                    selectionSet: {
                                      kind: 'SelectionSet',
                                      selections: [
                                        {
                                          kind: 'Field',
                                          name: { kind: 'Name', value: 'errors' },
                                          selectionSet: {
                                            kind: 'SelectionSet',
                                            selections: [
                                              {
                                                kind: 'Field',
                                                name: { kind: 'Name', value: 'path' },
                                              },
                                              {
                                                kind: 'Field',
                                                name: { kind: 'Name', value: 'message' },
                                              },
                                              {
                                                kind: 'Field',
                                                name: { kind: 'Name', value: 'name' },
                                              },
                                              {
                                                kind: 'Field',
                                                name: { kind: 'Name', value: 'context' },
                                              },
                                            ],
                                          },
                                        },
                                      ],
                                    },
                                  },
                                  {
                                    kind: 'InlineFragment',
                                    typeCondition: {
                                      kind: 'NamedType',
                                      name: { kind: 'Name', value: 'OperationError' },
                                    },
                                    selectionSet: {
                                      kind: 'SelectionSet',
                                      selections: [
                                        {
                                          kind: 'Field',
                                          name: { kind: 'Name', value: 'message' },
                                        },
                                        {
                                          kind: 'Field',
                                          name: { kind: 'Name', value: 'name' },
                                        },
                                        {
                                          kind: 'Field',
                                          name: { kind: 'Name', value: 'context' },
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
  containers_Admin_UsersAndRoles_gql_UserDeleteMutation,
  containers_Admin_UsersAndRoles_gql_UserDeleteMutationVariables
>

export { containers_Admin_UsersAndRoles_gql_UserDeleteDocument as default }
