/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import type { S3ObjectLocation } from 'model/S3'
import * as Types from '../../../../model/graphql/types.generated'

export interface StatusReportListFilter {
  readonly timestampFrom: Date | null | undefined
  readonly timestampTo: Date | null | undefined
}

export type StatusReportListOrder = 'NEW_FIRST' | 'OLD_FIRST'

export type containers_Admin_Status_gql_ReportsQueryVariables = Exact<{
  page: number
  perPage: number
  filter: Types.StatusReportListFilter
  order: Types.StatusReportListOrder
}>

export interface containers_Admin_Status_gql_ReportsQuery {
  readonly __typename: 'Query'
  readonly status:
    | {
        readonly __typename: 'Status'
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

export const containers_Admin_Status_gql_ReportsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Admin_Status_gql_Reports' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'page' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'perPage' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'StatusReportListFilter' },
            },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'order' } },
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
                        name: { kind: 'Name', value: 'reports' },
                        arguments: [
                          {
                            kind: 'Argument',
                            name: { kind: 'Name', value: 'filter' },
                            value: {
                              kind: 'Variable',
                              name: { kind: 'Name', value: 'filter' },
                            },
                          },
                        ],
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
                                  name: { kind: 'Name', value: 'number' },
                                  value: {
                                    kind: 'Variable',
                                    name: { kind: 'Name', value: 'page' },
                                  },
                                },
                                {
                                  kind: 'Argument',
                                  name: { kind: 'Name', value: 'perPage' },
                                  value: {
                                    kind: 'Variable',
                                    name: { kind: 'Name', value: 'perPage' },
                                  },
                                },
                                {
                                  kind: 'Argument',
                                  name: { kind: 'Name', value: 'order' },
                                  value: {
                                    kind: 'Variable',
                                    name: { kind: 'Name', value: 'order' },
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
  containers_Admin_Status_gql_ReportsQuery,
  containers_Admin_Status_gql_ReportsQueryVariables
>

export { containers_Admin_Status_gql_ReportsDocument as default }
