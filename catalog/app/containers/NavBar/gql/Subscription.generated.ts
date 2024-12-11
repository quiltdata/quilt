/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../model/graphql/types.generated'

export type containers_NavBar_gql_SubscriptionQueryVariables = Types.Exact<{
  [key: string]: never
}>

export type containers_NavBar_gql_SubscriptionQuery = { readonly __typename: 'Query' } & {
  readonly subscription: { readonly __typename: 'SubscriptionState' } & Pick<
    Types.SubscriptionState,
    'active' | 'timestamp'
  >
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
