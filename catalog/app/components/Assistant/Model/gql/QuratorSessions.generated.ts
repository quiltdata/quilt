/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../../model/graphql/types.generated'

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type components_Assistant_Model_gql_QuratorSessionsQueryVariables = Exact<{
  [key: string]: never
}>

export interface components_Assistant_Model_gql_QuratorSessionsQuery {
  readonly __typename: 'Query'
  readonly me: {
    readonly __typename: 'Me'
    readonly name: string
    readonly quratorSessionsEnabled: boolean
    readonly quratorSessions: ReadonlyArray<{
      readonly __typename: 'QuratorSession'
      readonly id: string
      readonly title: string
      readonly updatedAt: Date
      readonly eventCount: number
    }>
  } | null
  readonly config: {
    readonly __typename: 'Config'
    readonly quratorModels: {
      readonly __typename: 'QuratorModelConfig'
      readonly sessionsEnabled: boolean
    } | null
  }
}

export const components_Assistant_Model_gql_QuratorSessionsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'components_Assistant_Model_gql_QuratorSessions' },
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
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'quratorSessionsEnabled' },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'quratorSessions' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'eventCount' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'config' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'quratorModels' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'sessionsEnabled' } },
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
  components_Assistant_Model_gql_QuratorSessionsQuery,
  components_Assistant_Model_gql_QuratorSessionsQueryVariables
>

export { components_Assistant_Model_gql_QuratorSessionsDocument as default }
