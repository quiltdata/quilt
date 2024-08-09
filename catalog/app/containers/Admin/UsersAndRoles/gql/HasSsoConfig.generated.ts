/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type containers_Admin_UsersAndRoles_gql_HasSsoConfigQueryVariables = Types.Exact<{
  [key: string]: never
}>

export type containers_Admin_UsersAndRoles_gql_HasSsoConfigQuery = {
  readonly __typename: 'Query'
} & {
  readonly admin: { readonly __typename: 'AdminQueries' } & {
    readonly ssoConfig: Types.Maybe<
      { readonly __typename: 'SsoConfig' } & Pick<Types.SsoConfig, 'timestamp'>
    >
  }
}

export const containers_Admin_UsersAndRoles_gql_HasSsoConfigDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Admin_UsersAndRoles_gql_HasSsoConfig' },
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
                  name: { kind: 'Name', value: 'ssoConfig' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'timestamp' } },
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
  containers_Admin_UsersAndRoles_gql_HasSsoConfigQuery,
  containers_Admin_UsersAndRoles_gql_HasSsoConfigQueryVariables
>

export { containers_Admin_UsersAndRoles_gql_HasSsoConfigDocument as default }
