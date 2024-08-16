/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type website_pages_Landing_gql_MeQueryVariables = Types.Exact<{
  [key: string]: never
}>

export type website_pages_Landing_gql_MeQuery = { readonly __typename: 'Query' } & {
  readonly me: Types.Maybe<{ readonly __typename: 'Me' } & Pick<Types.Me, 'isAdmin'>>
}

export const website_pages_Landing_gql_MeDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'website_pages_Landing_gql_Me' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'me' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'isAdmin' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  website_pages_Landing_gql_MeQuery,
  website_pages_Landing_gql_MeQueryVariables
>

export { website_pages_Landing_gql_MeDocument as default }
