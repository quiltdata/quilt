/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../../model/graphql/types.generated'

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type containers_Admin_Settings_gql_McpServerProbeMutationVariables = Exact<{
  slug: string | number
}>

export interface containers_Admin_Settings_gql_McpServerProbeMutation {
  readonly __typename: 'Mutation'
  readonly admin: {
    readonly __typename: 'AdminMutations'
    readonly mcpServerProbe: {
      readonly __typename: 'McpServerProbe'
      readonly ok: boolean
      readonly failure: string | null
      readonly tools: ReadonlyArray<{
        readonly __typename: 'McpToolSummary'
        readonly name: string
        readonly description: string | null
        readonly readOnly: boolean | null
        readonly destructive: boolean | null
        readonly openWorld: boolean | null
      }>
    }
  }
}

export const containers_Admin_Settings_gql_McpServerProbeDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'containers_Admin_Settings_gql_McpServerProbe' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
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
                  name: { kind: 'Name', value: 'mcpServerProbe' },
                  arguments: [
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'slug' },
                      value: { kind: 'Variable', name: { kind: 'Name', value: 'slug' } },
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'ok' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'failure' } },
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
                            { kind: 'Field', name: { kind: 'Name', value: 'readOnly' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'destructive' },
                            },
                            { kind: 'Field', name: { kind: 'Name', value: 'openWorld' } },
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
  containers_Admin_Settings_gql_McpServerProbeMutation,
  containers_Admin_Settings_gql_McpServerProbeMutationVariables
>

export { containers_Admin_Settings_gql_McpServerProbeDocument as default }
