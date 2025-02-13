/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type GetEventRuleStatusQueryVariables = Types.Exact<{ [key: string]: never }>

export type GetEventRuleStatusQuery = { readonly __typename: 'Query' } & {
  readonly admin: { readonly __typename: 'AdminQueries' } & {
    readonly rocrate:
      | ({ readonly __typename: 'EventRuleStatusSuccess' } & Pick<
          Types.EventRuleStatusSuccess,
          'enabled'
        >)
      | { readonly __typename: 'OperationError' }
    readonly omics:
      | ({ readonly __typename: 'EventRuleStatusSuccess' } & Pick<
          Types.EventRuleStatusSuccess,
          'enabled'
        >)
      | { readonly __typename: 'OperationError' }
  }
}

export const GetEventRuleStatusDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'GetEventRuleStatus' },
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
                  alias: { kind: 'Name', value: 'rocrate' },
                  name: { kind: 'Name', value: 'eventRuleStatus' },
                  arguments: [
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'ruleType' },
                      value: { kind: 'EnumValue', value: 'ROCRATE' },
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'InlineFragment',
                        typeCondition: {
                          kind: 'NamedType',
                          name: { kind: 'Name', value: 'EventRuleStatusSuccess' },
                        },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'enabled' } },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  alias: { kind: 'Name', value: 'omics' },
                  name: { kind: 'Name', value: 'eventRuleStatus' },
                  arguments: [
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'ruleType' },
                      value: { kind: 'EnumValue', value: 'OMICS' },
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'InlineFragment',
                        typeCondition: {
                          kind: 'NamedType',
                          name: { kind: 'Name', value: 'EventRuleStatusSuccess' },
                        },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'enabled' } },
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
} as unknown as DocumentNode<GetEventRuleStatusQuery, GetEventRuleStatusQueryVariables>

export { GetEventRuleStatusDocument as default }
