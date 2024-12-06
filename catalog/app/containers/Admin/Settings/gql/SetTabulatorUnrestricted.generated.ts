/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type containers_Admin_Settings_gql_SetTabulatorUnrestrictedMutationVariables =
  Types.Exact<{
    value: Types.Scalars['Boolean']
  }>

export type containers_Admin_Settings_gql_SetTabulatorUnrestrictedMutation = {
  readonly __typename: 'Mutation'
} & {
  readonly admin: { readonly __typename: 'AdminMutations' } & {
    readonly setTabulatorUnrestricted: {
      readonly __typename: 'TabulatorUnrestrictedResult'
    } & Pick<Types.TabulatorUnrestrictedResult, 'tabulatorUnrestricted'>
  }
}

export const containers_Admin_Settings_gql_SetTabulatorUnrestrictedDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {
        kind: 'Name',
        value: 'containers_Admin_Settings_gql_SetTabulatorUnrestricted',
      },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'value' } },
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
                  name: { kind: 'Name', value: 'setTabulatorUnrestricted' },
                  arguments: [
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'value' },
                      value: { kind: 'Variable', name: { kind: 'Name', value: 'value' } },
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'tabulatorUnrestricted' },
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
  containers_Admin_Settings_gql_SetTabulatorUnrestrictedMutation,
  containers_Admin_Settings_gql_SetTabulatorUnrestrictedMutationVariables
>

export { containers_Admin_Settings_gql_SetTabulatorUnrestrictedDocument as default }
