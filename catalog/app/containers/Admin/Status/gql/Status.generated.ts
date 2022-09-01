/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type containers_Admin_Status_gql_StatusQueryVariables = Types.Exact<{
  statsWindow: Types.Scalars['Int']
  reportsPerPage: Types.Scalars['Int']
  reportsOrder: Types.StatusReportListOrder
}>

export type containers_Admin_Status_gql_StatusQuery = { readonly __typename: 'Query' } & {
  readonly status: Types.Maybe<
    { readonly __typename: 'Status' } & {
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
      readonly reports: { readonly __typename: 'StatusReportList' } & Pick<
        Types.StatusReportList,
        'total'
      > & {
          readonly page: ReadonlyArray<
            { readonly __typename: 'StatusReport' } & Pick<
              Types.StatusReport,
              'timestamp' | 'renderedReportLocation'
            >
          >
        }
    }
  >
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
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'statsWindow' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'reportsPerPage' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'reportsOrder' } },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'StatusReportListOrder' },
            },
          },
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
                        name: { kind: 'Name', value: 'statsWindow' },
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
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'reports' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'total' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'page' },
                        arguments: [
                          {
                            kind: 'Argument',
                            name: { kind: 'Name', value: 'perPage' },
                            value: {
                              kind: 'Variable',
                              name: { kind: 'Name', value: 'reportsPerPage' },
                            },
                          },
                          {
                            kind: 'Argument',
                            name: { kind: 'Name', value: 'order' },
                            value: {
                              kind: 'Variable',
                              name: { kind: 'Name', value: 'reportsOrder' },
                            },
                          },
                        ],
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'timestamp' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'renderedReportLocation' },
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
      },
    },
  ],
} as unknown as DocumentNode<
  containers_Admin_Status_gql_StatusQuery,
  containers_Admin_Status_gql_StatusQueryVariables
>

export { containers_Admin_Status_gql_StatusDocument as default }
