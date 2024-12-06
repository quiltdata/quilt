/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type containers_Admin_Settings_gql_TabulatorUnrestrictedQueryVariables =
  Types.Exact<{ [key: string]: never }>

export type containers_Admin_Settings_gql_TabulatorUnrestrictedQuery = {
  readonly __typename: 'Query'
} & {
  readonly admin: { readonly __typename: 'AdminQueries' } & Pick<
    Types.AdminQueries,
    'tabulatorUnrestricted'
  >
}

export const containers_Admin_Settings_gql_TabulatorUnrestrictedDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {
        kind: 'Name',
        value: 'containers_Admin_Settings_gql_TabulatorUnrestricted',
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'admin' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'tabulatorUnrestricted' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  containers_Admin_Settings_gql_TabulatorUnrestrictedQuery,
  containers_Admin_Settings_gql_TabulatorUnrestrictedQueryVariables
>

export { containers_Admin_Settings_gql_TabulatorUnrestrictedDocument as default }
