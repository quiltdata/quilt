/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../../model/graphql/types.generated'

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type McpServerAuth = 'HEADER' | 'NONE'

export interface McpServerInput {
  readonly auth: McpServerAuth
  readonly authHeader: string | null | undefined
  readonly authPrefix: string | null | undefined
  readonly enabled: boolean
  readonly forwardIdentity: boolean
  readonly hint: string | null | undefined
  /** Write-only. Omit to keep the stored secret; a URL whose origin changed clears it. */
  readonly secret: string | null | undefined
  readonly title: string
  readonly trusted: boolean
  readonly url: string
}

export type containers_Admin_Settings_gql_McpServerSetMutationVariables = Exact<{
  slug: string | number
  input: Types.McpServerInput
}>

export interface containers_Admin_Settings_gql_McpServerSetMutation {
  readonly __typename: 'Mutation'
  readonly admin: {
    readonly __typename: 'AdminMutations'
    readonly mcpServerSet:
      | {
          readonly __typename: 'InvalidInput'
          readonly errors: ReadonlyArray<{
            readonly __typename: 'InputError'
            readonly path: string | null
            readonly name: string
            readonly message: string
          }>
        }
      | {
          readonly __typename: 'McpServerAdmin'
          readonly slug: string
          readonly title: string
          readonly url: string
          readonly hint: string | null
          readonly enabled: boolean
          readonly trusted: boolean
          readonly auth: Types.McpServerAuth
          readonly authHeader: string | null
          readonly authPrefix: string | null
          readonly hasSecret: boolean
          readonly forwardIdentity: boolean
          readonly updatedAt: Date
        }
      | {
          readonly __typename: 'OperationError'
          readonly name: string
          readonly message: string
        }
  }
}

export const containers_Admin_Settings_gql_McpServerSetDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'containers_Admin_Settings_gql_McpServerSet' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'input' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'McpServerInput' } },
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
                  name: { kind: 'Name', value: 'mcpServerSet' },
                  arguments: [
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'slug' },
                      value: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
                    },
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
                          name: { kind: 'Name', value: 'McpServerAdmin' },
                        },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'slug' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'url' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'hint' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'enabled' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'trusted' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'auth' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'authHeader' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'authPrefix' },
                            },
                            { kind: 'Field', name: { kind: 'Name', value: 'hasSecret' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'forwardIdentity' },
                            },
                            { kind: 'Field', name: { kind: 'Name', value: 'updatedAt' } },
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
                                    name: { kind: 'Name', value: 'name' },
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
                            { kind: 'Field', name: { kind: 'Name', value: 'name' } },
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
  containers_Admin_Settings_gql_McpServerSetMutation,
  containers_Admin_Settings_gql_McpServerSetMutationVariables
>

export { containers_Admin_Settings_gql_McpServerSetDocument as default }
