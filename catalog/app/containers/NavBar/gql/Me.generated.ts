/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../model/graphql/types.generated'

export type containers_NavBar_gql_MeQueryVariables = Types.Exact<{ [key: string]: never }>

export type containers_NavBar_gql_MeQuery = { readonly __typename: 'Query' } & {
  readonly me: Types.Maybe<
    { readonly __typename: 'Me' } & Pick<Types.Me, 'name' | 'email' | 'isAdmin'> & {
        readonly role: { readonly __typename: 'MyRole' } & Pick<Types.MyRole, 'name'>
        readonly roles: ReadonlyArray<
          { readonly __typename: 'MyRole' } & Pick<Types.MyRole, 'name'>
        >
      }
  >
}

export const containers_NavBar_gql_MeDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_NavBar_gql_Me' },
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
  containers_NavBar_gql_MeQuery,
  containers_NavBar_gql_MeQueryVariables
>

export { containers_NavBar_gql_MeDocument as default }
