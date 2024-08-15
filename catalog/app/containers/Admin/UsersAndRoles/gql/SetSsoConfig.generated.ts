/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type containers_Admin_UsersAndRoles_gql_SetSsoConfigMutationVariables =
  Types.Exact<{
    config: Types.Maybe<Types.Scalars['String']>
  }>

export type containers_Admin_UsersAndRoles_gql_SetSsoConfigMutation = {
  readonly __typename: 'Mutation'
} & {
  readonly admin: { readonly __typename: 'AdminMutations' } & {
    readonly setSsoConfig:
      | ({ readonly __typename: 'SsoConfig' } & Pick<
          Types.SsoConfig,
          'timestamp' | 'text'
        >)
      | ({ readonly __typename: 'InvalidInput' } & {
          readonly errors: ReadonlyArray<
            { readonly __typename: 'InputError' } & Pick<
              Types.InputError,
              'path' | 'message'
            >
          >
        })
      | ({ readonly __typename: 'OperationError' } & Pick<
          Types.OperationError,
          'message'
        >)
  }
}

export const containers_Admin_UsersAndRoles_gql_SetSsoConfigDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'containers_Admin_UsersAndRoles_gql_SetSsoConfig' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'config' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
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
                  name: { kind: 'Name', value: 'setSsoConfig' },
                  arguments: [
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'config' },
                      value: {
                        kind: 'Variable',
                        name: { kind: 'Name', value: 'config' },
                      },
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
                          name: { kind: 'Name', value: 'SsoConfig' },
                        },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'timestamp' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'text' } },
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
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'path' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'message' },
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
  containers_Admin_UsersAndRoles_gql_SetSsoConfigMutation,
  containers_Admin_UsersAndRoles_gql_SetSsoConfigMutationVariables
>

export { containers_Admin_UsersAndRoles_gql_SetSsoConfigDocument as default }
