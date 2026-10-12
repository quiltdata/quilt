/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../../model/graphql/types.generated'

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type components_Assistant_Model_gql_McpServersQueryVariables = Exact<{
  [key: string]: never
}>

export interface components_Assistant_Model_gql_McpServersQuery {
  readonly __typename: 'Query'
  readonly mcpServers: ReadonlyArray<{
    readonly __typename: 'McpServer'
    readonly slug: string
    readonly title: string
    readonly hint: string | null
    readonly trusted: boolean
  }>
}

export const components_Assistant_Model_gql_McpServersDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'components_Assistant_Model_gql_McpServers' },
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
                { kind: 'Field', name: { kind: 'Name', value: 'hint' } },
                { kind: 'Field', name: { kind: 'Name', value: 'trusted' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  components_Assistant_Model_gql_McpServersQuery,
  components_Assistant_Model_gql_McpServersQueryVariables
>

export { components_Assistant_Model_gql_McpServersDocument as default }
