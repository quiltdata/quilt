/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../model/graphql/types.generated'

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type containers_NavBar_gql_SubscriptionQueryVariables = Exact<{
  [key: string]: never
}>

export interface containers_NavBar_gql_SubscriptionQuery {
  readonly __typename: 'Query'
  readonly subscription: {
    readonly __typename: 'SubscriptionState'
    readonly active: boolean
    readonly timestamp: Date
  }
}

export const containers_NavBar_gql_SubscriptionDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_NavBar_gql_Subscription' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'subscription' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'active' } },
                { kind: 'Field', name: { kind: 'Name', value: 'timestamp' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  containers_NavBar_gql_SubscriptionQuery,
  containers_NavBar_gql_SubscriptionQueryVariables
>

export { containers_NavBar_gql_SubscriptionDocument as default }
