/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../../model/graphql/types.generated'

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type McpServerAuth = 'HEADER' | 'NONE' | 'OAUTH'

export type containers_Admin_Settings_gql_McpServersQueryVariables = Exact<{
  [key: string]: never
}>

export interface containers_Admin_Settings_gql_McpServersQuery {
  readonly __typename: 'Query'
  readonly admin: {
    readonly __typename: 'AdminQueries'
    readonly mcpServersAvailable: boolean
    readonly mcpServers: ReadonlyArray<{
      readonly __typename: 'McpServerAdmin'
      readonly slug: string
      readonly title: string
      readonly url: string
      readonly hint: string | null
      readonly enabled: boolean
      readonly trusted: boolean
      readonly auth: Types.McpServerAuth
      readonly authHeader: string | null
      readonly authPrefix: string | null
      readonly hasSecret: boolean
      readonly forwardIdentity: boolean
      readonly updatedAt: Date
      readonly oauthClientId: string | null
      readonly hasOauthClientSecret: boolean
      readonly oauthRedirectUri: string | null
      readonly signedInUsers: number
    }>
  }
}

export const containers_Admin_Settings_gql_McpServersDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Admin_Settings_gql_McpServers' },
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
                  name: { kind: 'Name', value: 'mcpServers' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'hint' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'enabled' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'trusted' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'auth' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'authHeader' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'authPrefix' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'hasSecret' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'forwardIdentity' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'oauthClientId' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'hasOauthClientSecret' },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'oauthRedirectUri' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'signedInUsers' } },
                    ],
                  },
                },
                { kind: 'Field', name: { kind: 'Name', value: 'mcpServersAvailable' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  containers_Admin_Settings_gql_McpServersQuery,
  containers_Admin_Settings_gql_McpServersQueryVariables
>

export { containers_Admin_Settings_gql_McpServersDocument as default }
