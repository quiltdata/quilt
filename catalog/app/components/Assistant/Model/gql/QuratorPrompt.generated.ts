/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../../model/graphql/types.generated'

import type { JsonRecord } from 'utils/types'
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type components_Assistant_Model_gql_QuratorPromptQueryVariables = Exact<{
  [key: string]: never
}>

export interface components_Assistant_Model_gql_QuratorPromptQuery {
  readonly __typename: 'Query'
  readonly config: {
    readonly __typename: 'Config'
    readonly quratorPrompt: {
      readonly __typename: 'QuratorPrompt'
      readonly version: string
      readonly system: string
      readonly taskContext: string
      readonly taskDescription: string
      readonly conversationStart: string
      readonly conversationEnd: string
      readonly immediateTask: string
      readonly readingGuidance: string
      readonly tools: ReadonlyArray<{
        readonly __typename: 'QuratorPromptTool'
        readonly name: string
        readonly description: string
        readonly inputSchema: JsonRecord
      }>
    } | null
  }
}

export const components_Assistant_Model_gql_QuratorPromptDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'components_Assistant_Model_gql_QuratorPrompt' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'config' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'quratorPrompt' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'version' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'system' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'taskContext' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'taskDescription' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'conversationStart' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'conversationEnd' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'immediateTask' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'readingGuidance' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'tools' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'description' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'inputSchema' },
                            },
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
      },
    },
  ],
} as unknown as DocumentNode<
  components_Assistant_Model_gql_QuratorPromptQuery,
  components_Assistant_Model_gql_QuratorPromptQueryVariables
>

export { components_Assistant_Model_gql_QuratorPromptDocument as default }
