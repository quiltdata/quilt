/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../model/graphql/types.generated'

export type containers_Sidebar_gql_MeQueryVariables = Exact<{ [key: string]: never }>

export interface containers_Sidebar_gql_MeQuery {
  readonly __typename: 'Query'
  readonly me: {
    readonly __typename: 'Me'
    readonly name: string
    readonly email: string
    readonly isAdmin: boolean
    readonly role: { readonly __typename: 'MyRole'; readonly name: string }
    readonly roles: ReadonlyArray<{
      readonly __typename: 'MyRole'
      readonly name: string
    }>
  } | null
}

export const containers_Sidebar_gql_MeDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Sidebar_gql_Me' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'me' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'email' } },
                { kind: 'Field', name: { kind: 'Name', value: 'isAdmin' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'role' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'roles' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
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
  containers_Sidebar_gql_MeQuery,
  containers_Sidebar_gql_MeQueryVariables
>

export { containers_Sidebar_gql_MeDocument as default }
