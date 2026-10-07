/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../../model/graphql/types.generated'

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
/**
 * Replaces the whole Qurator configuration. Every field is explicit, so a write
 * states the full intent: omitting one does not preserve it. Null clears a field.
 * The two session fields are the exception: omitting one keeps its stored value.
 */
export interface QuratorConfigInput {
  readonly allowlist: Array<string> | null | undefined
  readonly default: string | null | undefined
  readonly gatewayAccountId: string | null | undefined
  readonly gatewayEndpointUrl: string | null | undefined
  readonly maxToolCallsPerTurn: number | null | undefined
  /** Each id must be in `allowlist`; each name, once trimmed, is 1 to 64 printable characters. */
  readonly names: Array<QuratorModelNameInput> | null | undefined
  readonly requestTimeoutSeconds: number | null | undefined
  /** 1 to 500. */
  readonly sessionMaxPerUser: number | null | undefined
  /** 0 to 3650. 0 hides every session without deleting it; `quratorSessionsPurgeAll` deletes. */
  readonly sessionRetentionDays: number | null | undefined
}

export interface QuratorModelNameInput {
  readonly id: string
  readonly name: string
}

export type containers_Admin_Settings_gql_SetQuratorConfigMutationVariables = Exact<{
  input: Types.QuratorConfigInput
}>

export interface containers_Admin_Settings_gql_SetQuratorConfigMutation {
  readonly __typename: 'Mutation'
  readonly admin: {
    readonly __typename: 'AdminMutations'
    readonly setQuratorConfig:
      | {
          readonly __typename: 'InvalidInput'
          readonly errors: ReadonlyArray<{
            readonly __typename: 'InputError'
            readonly path: string | null
            readonly message: string
          }>
        }
      | { readonly __typename: 'OperationError'; readonly message: string }
      | {
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

export const containers_Admin_Settings_gql_SetQuratorConfigDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'containers_Admin_Settings_gql_SetQuratorConfig' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'input' } },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'QuratorConfigInput' },
            },
          },
        },
      ],
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
                  name: { kind: 'Name', value: 'setQuratorConfig' },
                  arguments: [
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'input' },
                      value: { kind: 'Variable', name: { kind: 'Name', value: 'input' } },
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
                      {
                        kind: 'InlineFragment',
                        typeCondition: {
                          kind: 'NamedType',
                          name: { kind: 'Name', value: 'QuratorConfig' },
                        },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'models' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'allowlist' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'default' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: {
                                      kind: 'Name',
                                      value: 'requestTimeoutSeconds',
                                    },
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
                                        {
                                          kind: 'Field',
                                          name: { kind: 'Name', value: 'id' },
                                        },
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
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'accountId' },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'InlineFragment',
                        typeCondition: {
                          kind: 'NamedType',
                          name: { kind: 'Name', value: 'InvalidInput' },
                        },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'errors' },
                              selectionSet: {
                                kind: 'SelectionSet',
                                selections: [
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'path' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'message' },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'InlineFragment',
                        typeCondition: {
                          kind: 'NamedType',
                          name: { kind: 'Name', value: 'OperationError' },
                        },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'message' } },
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
  containers_Admin_Settings_gql_SetQuratorConfigMutation,
  containers_Admin_Settings_gql_SetQuratorConfigMutationVariables
>

export { containers_Admin_Settings_gql_SetQuratorConfigDocument as default }
