/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type containers_Admin_Settings_gql_TabulatorOpenQueryQueryVariables = Types.Exact<{
  [key: string]: never
}>

export type containers_Admin_Settings_gql_TabulatorOpenQueryQuery = {
  readonly __typename: 'Query'
} & {
  readonly admin: { readonly __typename: 'AdminQueries' } & Pick<
    Types.AdminQueries,
    'tabulatorOpenQuery'
  >
}

export const containers_Admin_Settings_gql_TabulatorOpenQueryDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Admin_Settings_gql_TabulatorOpenQuery' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'admin' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'tabulatorOpenQuery' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  containers_Admin_Settings_gql_TabulatorOpenQueryQuery,
  containers_Admin_Settings_gql_TabulatorOpenQueryQueryVariables
>

export { containers_Admin_Settings_gql_TabulatorOpenQueryDocument as default }
