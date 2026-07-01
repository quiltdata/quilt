/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type containers_Admin_Settings_gql_TabulatorOpenQueryQueryVariables = Exact<{
  [key: string]: never
}>

export interface containers_Admin_Settings_gql_TabulatorOpenQueryQuery {
  readonly __typename: 'Query'
  readonly admin: {
    readonly __typename: 'AdminQueries'
    readonly tabulatorOpenQuery: boolean
  }
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
