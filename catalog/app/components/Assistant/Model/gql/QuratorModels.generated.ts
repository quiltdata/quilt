/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../../model/graphql/types.generated'

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type components_Assistant_Model_gql_QuratorModelsQueryVariables = Exact<{
  [key: string]: never
}>

export interface components_Assistant_Model_gql_QuratorModelsQuery {
  readonly __typename: 'Query'
  readonly config: {
    readonly __typename: 'Config'
    readonly quratorModels: {
      readonly __typename: 'QuratorModelConfig'
      readonly allowlist: ReadonlyArray<string> | null
      readonly default: string | null
    } | null
  }
}

export const components_Assistant_Model_gql_QuratorModelsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'components_Assistant_Model_gql_QuratorModels' },
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
                  name: { kind: 'Name', value: 'quratorModels' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'allowlist' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'default' } },
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
  components_Assistant_Model_gql_QuratorModelsQuery,
  components_Assistant_Model_gql_QuratorModelsQueryVariables
>

export { components_Assistant_Model_gql_QuratorModelsDocument as default }
