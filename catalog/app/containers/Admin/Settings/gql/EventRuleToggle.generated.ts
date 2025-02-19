/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type ToggleEventRuleMutationVariables = Types.Exact<{
  ruleType: Types.EventRuleType
  enableRule: Types.Scalars['Boolean']
}>

export type ToggleEventRuleMutation = { readonly __typename: 'Mutation' } & {
  readonly admin: { readonly __typename: 'AdminMutations' } & {
    readonly eventRuleToggle:
      | ({ readonly __typename: 'EventRuleToggleSuccess' } & Pick<
          Types.EventRuleToggleSuccess,
          'ruleArn'
        >)
      | { readonly __typename: 'OperationError' }
  }
}

export const ToggleEventRuleDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'ToggleEventRule' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'ruleType' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'EventRuleType' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'enableRule' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
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
                  name: { kind: 'Name', value: 'eventRuleToggle' },
                  arguments: [
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'ruleType' },
                      value: {
                        kind: 'Variable',
                        name: { kind: 'Name', value: 'ruleType' },
                      },
                    },
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'enableRule' },
                      value: {
                        kind: 'Variable',
                        name: { kind: 'Name', value: 'enableRule' },
                      },
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'InlineFragment',
                        typeCondition: {
                          kind: 'NamedType',
                          name: { kind: 'Name', value: 'EventRuleToggleSuccess' },
                        },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'ruleArn' } },
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
} as unknown as DocumentNode<ToggleEventRuleMutation, ToggleEventRuleMutationVariables>

export { ToggleEventRuleDocument as default }
