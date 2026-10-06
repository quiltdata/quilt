/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../../model/graphql/types.generated'

import type { Json } from 'utils/types'
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type containers_Admin_Buckets_gql_EventWiringQueryVariables = Exact<{
  bucket: string
}>

export interface containers_Admin_Buckets_gql_EventWiringQuery {
  readonly __typename: 'Query'
  readonly bucketConfig: {
    readonly __typename: 'BucketConfig'
    readonly name: string
    readonly eventBridgeWiring: {
      readonly __typename: 'EventBridgeWiring'
      readonly ruleName: string
      readonly eventPattern: Json
      readonly stackBusArn: string
      readonly stackAccountId: string
      readonly stackRegion: string
      readonly forwardingRoleArn: string
      readonly eventsLast24h: number | null
    } | null
  } | null
  readonly admin: {
    readonly __typename: 'AdminQueries'
    readonly eventBridgeAccounts: {
      readonly __typename: 'EventBridgeAccounts'
      readonly admitted: ReadonlyArray<string>
    }
  }
}

export const containers_Admin_Buckets_gql_EventWiringDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Admin_Buckets_gql_EventWiring' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'bucket' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'bucketConfig' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'name' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'bucket' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'eventBridgeWiring' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'ruleName' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'eventPattern' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'stackBusArn' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'stackAccountId' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'stackRegion' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'forwardingRoleArn' },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'eventsLast24h' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'admin' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'eventBridgeAccounts' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'admitted' } },
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
  containers_Admin_Buckets_gql_EventWiringQuery,
  containers_Admin_Buckets_gql_EventWiringQueryVariables
>

export { containers_Admin_Buckets_gql_EventWiringDocument as default }
