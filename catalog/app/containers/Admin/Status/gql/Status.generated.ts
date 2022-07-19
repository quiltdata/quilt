/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type containers_Admin_Status_gql_StatusQueryVariables = Types.Exact<{
  window: Types.Maybe<Types.Scalars['Int']>
}>

export type containers_Admin_Status_gql_StatusQuery = { readonly __typename: 'Query' } & {
  readonly status: { readonly __typename: 'Status' } & {
    readonly canaries: ReadonlyArray<
      { readonly __typename: 'Canary' } & Pick<
        Types.Canary,
        | 'name'
        | 'region'
        | 'group'
        | 'title'
        | 'description'
        | 'schedule'
        | 'ok'
        | 'lastRun'
      >
    >
    readonly latestStats: { readonly __typename: 'TestStats' } & Pick<
      Types.TestStats,
      'passed' | 'failed' | 'running'
    >
    readonly stats: { readonly __typename: 'TestStatsTimeSeries' } & Pick<
      Types.TestStatsTimeSeries,
      'datetimes' | 'passed' | 'failed'
    >
  }
}

export const containers_Admin_Status_gql_StatusDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Admin_Status_gql_Status' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'window' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'status' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'canaries' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'region' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'group' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'description' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'schedule' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'ok' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'lastRun' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'latestStats' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'passed' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'failed' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'running' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'stats' },
                  arguments: [
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'window' },
                      value: {
                        kind: 'Variable',
                        name: { kind: 'Name', value: 'window' },
                      },
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'datetimes' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'passed' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'failed' } },
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
  containers_Admin_Status_gql_StatusQuery,
  containers_Admin_Status_gql_StatusQueryVariables
>

export { containers_Admin_Status_gql_StatusDocument as default }
