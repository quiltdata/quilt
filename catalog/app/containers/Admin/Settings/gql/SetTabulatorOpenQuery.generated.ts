/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type containers_Admin_Settings_gql_SetTabulatorOpenQueryMutationVariables =
  Types.Exact<{
    enabled: Types.Scalars['Boolean']
  }>

export type containers_Admin_Settings_gql_SetTabulatorOpenQueryMutation = {
  readonly __typename: 'Mutation'
} & {
  readonly admin: { readonly __typename: 'AdminMutations' } & {
    readonly setTabulatorOpenQuery: {
      readonly __typename: 'TabulatorOpenQueryResult'
    } & Pick<Types.TabulatorOpenQueryResult, 'tabulatorOpenQuery'>
  }
}

export const containers_Admin_Settings_gql_SetTabulatorOpenQueryDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {
        kind: 'Name',
        value: 'containers_Admin_Settings_gql_SetTabulatorOpenQuery',
      },
      variableDefinitions: [
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
                  name: { kind: 'Name', value: 'setTabulatorOpenQuery' },
                  arguments: [
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
                        name: { kind: 'Name', value: 'tabulatorOpenQuery' },
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
  containers_Admin_Settings_gql_SetTabulatorOpenQueryMutation,
  containers_Admin_Settings_gql_SetTabulatorOpenQueryMutationVariables
>

export { containers_Admin_Settings_gql_SetTabulatorOpenQueryDocument as default }
