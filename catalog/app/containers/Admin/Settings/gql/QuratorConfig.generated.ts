/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../../model/graphql/types.generated'

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type containers_Admin_Settings_gql_QuratorConfigQueryVariables = Exact<{
  [key: string]: never
}>

export interface containers_Admin_Settings_gql_QuratorConfigQuery {
  readonly __typename: 'Query'
  readonly admin: {
    readonly __typename: 'AdminQueries'
    readonly quratorConfig: {
      readonly __typename: 'QuratorConfig'
      readonly models: {
        readonly __typename: 'QuratorModelConfig'
        readonly allowlist: ReadonlyArray<string> | null
        readonly default: string | null
        readonly requestTimeoutSeconds: number | null
        readonly maxToolCallsPerTurn: number | null
        readonly sessionRetentionDays: number | null
        readonly sessionMaxPerUser: number | null
        readonly names: ReadonlyArray<{
          readonly __typename: 'QuratorModelName'
          readonly id: string
          readonly name: string
        }> | null
      }
      readonly gateway: {
        readonly __typename: 'QuratorGatewayConfig'
        readonly endpointUrl: string | null
        readonly accountId: string | null
      }
    }
  }
}

export const containers_Admin_Settings_gql_QuratorConfigDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Admin_Settings_gql_QuratorConfig' },
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
                  name: { kind: 'Name', value: 'quratorConfig' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'models' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'allowlist' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'default' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'requestTimeoutSeconds' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'maxToolCallsPerTurn' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'sessionRetentionDays' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'sessionMaxPerUser' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'names' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'name' },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'gateway' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'endpointUrl' },
                            },
                            { kind: 'Field', name: { kind: 'Name', value: 'accountId' } },
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
  containers_Admin_Settings_gql_QuratorConfigQuery,
  containers_Admin_Settings_gql_QuratorConfigQueryVariables
>

export { containers_Admin_Settings_gql_QuratorConfigDocument as default }
