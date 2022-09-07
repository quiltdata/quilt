/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type containers_Admin_Status_gql_ReportsQueryVariables = Types.Exact<{
  page: Types.Scalars['Int']
  perPage: Types.Scalars['Int']
  filter: Types.StatusReportListFilter
  order: Types.StatusReportListOrder
}>

export type containers_Admin_Status_gql_ReportsQuery = {
  readonly __typename: 'Query'
} & {
  readonly status:
    | ({ readonly __typename: 'Status' } & {
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
      })
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
