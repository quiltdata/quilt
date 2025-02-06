/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type EventRuleToggleROCrateMutationVariables = Types.Exact<{
  enableRule: Types.Scalars['Boolean']
}>

export type EventRuleToggleROCrateMutation = { readonly __typename: 'Mutation' } & {
  readonly eventRuleToggle: Types.Maybe<
    | ({ readonly __typename: 'EventRuleToggleSuccess' } & Pick<
        Types.EventRuleToggleSuccess,
        'ruleArn'
      >)
    | ({ readonly __typename: 'OperationError' } & Pick<
        Types.OperationError,
        'message' | 'name' | 'context'
      >)
  >
}

export const EventRuleToggleROCrateDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'EventRuleToggleROCrate' },
      variableDefinitions: [
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
            name: { kind: 'Name', value: 'eventRuleToggle' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'ruleType' },
                value: { kind: 'EnumValue', value: 'ROCRATE' },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'enableRule' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'enableRule' } },
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
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'context' } },
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
  EventRuleToggleROCrateMutation,
  EventRuleToggleROCrateMutationVariables
>

export { EventRuleToggleROCrateDocument as default }
