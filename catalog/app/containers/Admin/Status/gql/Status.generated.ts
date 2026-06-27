/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../../model/graphql/types.generated'

import type { S3ObjectLocation } from 'model/S3'
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type StatusReportListOrder = 'NEW_FIRST' | 'OLD_FIRST'

export type containers_Admin_Status_gql_StatusQueryVariables = Exact<{
  statsWindow: number
  reportsPerPage: number
  reportsOrder: Types.StatusReportListOrder
}>

export interface containers_Admin_Status_gql_StatusQuery {
  readonly __typename: 'Query'
  readonly status:
    | {
        readonly __typename: 'Status'
        readonly canaries: ReadonlyArray<{
          readonly __typename: 'Canary'
          readonly name: string
          readonly region: string
          readonly group: string
          readonly title: string
          readonly description: string
          readonly schedule: string
          readonly ok: boolean | null
          readonly lastRun: Date | null
        }>
        readonly latestStats: {
          readonly __typename: 'TestStats'
          readonly passed: number
          readonly failed: number
          readonly running: number
        }
        readonly stats: {
          readonly __typename: 'TestStatsTimeSeries'
          readonly datetimes: ReadonlyArray<Date>
          readonly passed: ReadonlyArray<number>
          readonly failed: ReadonlyArray<number>
        }
        readonly reports: {
          readonly __typename: 'StatusReportList'
          readonly total: number
          readonly page: ReadonlyArray<{
            readonly __typename: 'StatusReport'
            readonly timestamp: Date
            readonly renderedReportLocation: S3ObjectLocation
          }>
        }
      }
    | { readonly __typename: 'Unavailable' }
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
                { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
                {
                  kind: 'InlineFragment',
                  typeCondition: {
                    kind: 'NamedType',
                    name: { kind: 'Name', value: 'Status' },
                  },
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
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'description' },
                            },
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
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'timestamp' },
                                  },
                                  {
                                    kind: 'Field',
                                    name: {
                                      kind: 'Name',
                                      value: 'renderedReportLocation',
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
