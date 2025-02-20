/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type containers_Admin_Settings_gql_PackagerToggleEventRuleMutationVariables =
  Types.Exact<{
    name: Types.Scalars['String']
    enabled: Types.Scalars['Boolean']
  }>

export type containers_Admin_Settings_gql_PackagerToggleEventRuleMutation = {
  readonly __typename: 'Mutation'
} & {
  readonly admin: { readonly __typename: 'AdminMutations' } & {
    readonly packager: { readonly __typename: 'PackagerAdminMutations' } & {
      readonly toggleEventRule:
        | ({ readonly __typename: 'PackagerEventRule' } & Pick<
            Types.PackagerEventRule,
            'name' | 'enabled' | 'description'
          >)
        | ({ readonly __typename: 'OperationError' } & Pick<
            Types.OperationError,
            'message'
          >)
        | ({ readonly __typename: 'InvalidInput' } & {
            readonly errors: ReadonlyArray<
              { readonly __typename: 'InputError' } & Pick<
                Types.InputError,
                'path' | 'message'
              >
            >
          })
    }
  }
}

export const containers_Admin_Settings_gql_PackagerToggleEventRuleDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {
        kind: 'Name',
        value: 'containers_Admin_Settings_gql_PackagerToggleEventRule',
      },
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
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'enabled' } },
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
                  name: { kind: 'Name', value: 'packager' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'toggleEventRule' },
                        arguments: [
                          {
                            kind: 'Argument',
                            name: { kind: 'Name', value: 'name' },
                            value: {
                              kind: 'Variable',
                              name: { kind: 'Name', value: 'name' },
                            },
                          },
                          {
                            kind: 'Argument',
                            name: { kind: 'Name', value: 'enabled' },
                            value: {
                              kind: 'Variable',
                              name: { kind: 'Name', value: 'enabled' },
                            },
                          },
                        ],
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
                                ],
                              },
                            },
                            {
                              kind: 'InlineFragment',
                              typeCondition: {
                                kind: 'NamedType',
                                name: { kind: 'Name', value: 'PackagerEventRule' },
                              },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'name' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'enabled' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'description' },
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
  containers_Admin_Settings_gql_PackagerToggleEventRuleMutation,
  containers_Admin_Settings_gql_PackagerToggleEventRuleMutationVariables
>

export { containers_Admin_Settings_gql_PackagerToggleEventRuleDocument as default }
