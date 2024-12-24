/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type containers_Admin_UsersAndRoles_gql_SsoConfigQueryVariables = Types.Exact<{
  [key: string]: never
}>

export type containers_Admin_UsersAndRoles_gql_SsoConfigQuery = {
  readonly __typename: 'Query'
} & {
  readonly admin: { readonly __typename: 'AdminQueries' } & {
    readonly ssoConfig: Types.Maybe<
      { readonly __typename: 'SsoConfig' } & Pick<Types.SsoConfig, 'text' | 'timestamp'>
    >
  }
}

export const containers_Admin_UsersAndRoles_gql_SsoConfigDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Admin_UsersAndRoles_gql_SsoConfig' },
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
                      { kind: 'Field', name: { kind: 'Name', value: 'text' } },
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
  containers_Admin_UsersAndRoles_gql_SsoConfigQuery,
  containers_Admin_UsersAndRoles_gql_SsoConfigQueryVariables
>

export { containers_Admin_UsersAndRoles_gql_SsoConfigDocument as default }
