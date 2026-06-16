/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type website_pages_Landing_gql_IsAdminQueryVariables = Exact<{
  [key: string]: never
}>

export interface website_pages_Landing_gql_IsAdminQuery {
  readonly __typename: 'Query'
  readonly me: {
    readonly __typename: 'Me'
    readonly isAdmin: boolean
    readonly name: string
  } | null
}

export const website_pages_Landing_gql_IsAdminDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'website_pages_Landing_gql_IsAdmin' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'me' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'isAdmin' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  website_pages_Landing_gql_IsAdminQuery,
  website_pages_Landing_gql_IsAdminQueryVariables
>

export { website_pages_Landing_gql_IsAdminDocument as default }
