/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../model/graphql/types.generated'

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type containers_NavBar_gql_SwitchRoleMutationVariables = Exact<{
  roleName: string
}>

export interface containers_NavBar_gql_SwitchRoleMutation {
  readonly __typename: 'Mutation'
  readonly switchRole:
    | {
        readonly __typename: 'InvalidInput'
        readonly errors: ReadonlyArray<{
          readonly __typename: 'InputError'
          readonly name: string
          readonly path: string | null
          readonly message: string
        }>
      }
    | { readonly __typename: 'Me' }
    | {
        readonly __typename: 'OperationError'
        readonly message: string
        readonly name: string
      }
}

export const containers_NavBar_gql_SwitchRoleDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'containers_NavBar_gql_SwitchRole' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'roleName' } },
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
            name: { kind: 'Name', value: 'switchRole' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'roleName' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'roleName' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
                {
                  kind: 'InlineFragment',
                  typeCondition: {
                    kind: 'NamedType',
                    name: { kind: 'Name', value: 'OperationError' },
                  },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                    ],
                  },
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
                            { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'path' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'message' } },
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
  containers_NavBar_gql_SwitchRoleMutation,
  containers_NavBar_gql_SwitchRoleMutationVariables
>

export { containers_NavBar_gql_SwitchRoleDocument as default }
