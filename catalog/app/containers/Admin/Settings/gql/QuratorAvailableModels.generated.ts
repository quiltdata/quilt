/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../../model/graphql/types.generated'

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type QuratorModelListingUnavailable =
  /** A gateway is configured; it has no listing route, so models are entered by hand. */
  | 'GATEWAY'
  /** Bedrock refused or failed the listing; models can still be entered by hand. */
  | 'LISTING_FAILED'

export type containers_Admin_Settings_gql_QuratorAvailableModelsQueryVariables = Exact<{
  [key: string]: never
}>

export interface containers_Admin_Settings_gql_QuratorAvailableModelsQuery {
  readonly __typename: 'Query'
  readonly admin: {
    readonly __typename: 'AdminQueries'
    readonly quratorAvailableModels: {
      readonly __typename: 'QuratorAvailableModels'
      readonly unavailable: Types.QuratorModelListingUnavailable | null
      readonly models: ReadonlyArray<{
        readonly __typename: 'QuratorAvailableModel'
        readonly id: string
        readonly name: string
        readonly provider: string | null
      }> | null
    }
  }
}

export const containers_Admin_Settings_gql_QuratorAvailableModelsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {
        kind: 'Name',
        value: 'containers_Admin_Settings_gql_QuratorAvailableModels',
      },
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
                  name: { kind: 'Name', value: 'quratorAvailableModels' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'models' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'provider' } },
                          ],
                        },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'unavailable' } },
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
  containers_Admin_Settings_gql_QuratorAvailableModelsQuery,
  containers_Admin_Settings_gql_QuratorAvailableModelsQueryVariables
>

export { containers_Admin_Settings_gql_QuratorAvailableModelsDocument as default }
