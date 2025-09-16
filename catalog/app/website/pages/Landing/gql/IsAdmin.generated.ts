/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type website_pages_Landing_gql_IsAdminQueryVariables = Types.Exact<{
  [key: string]: never
}>

export type website_pages_Landing_gql_IsAdminQuery = { readonly __typename: 'Query' } & {
  readonly me: Types.Maybe<
    { readonly __typename: 'Me' } & Pick<Types.Me, 'isAdmin' | 'name'>
  >
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
