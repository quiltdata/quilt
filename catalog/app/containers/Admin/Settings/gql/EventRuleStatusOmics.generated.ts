/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type EventRuleStatusOmicsQueryVariables = Types.Exact<{
  [key: string]: never
}>

export type EventRuleStatusOmicsQuery = { readonly __typename: 'Query' } & {
  readonly admin: { readonly __typename: 'AdminQueries' } & {
    readonly eventRuleStatus: Types.Maybe<
      | ({ readonly __typename: 'EventRuleStatusSucces' } & Pick<
          Types.EventRuleStatusSuccess,
          'enabled' | 'ruleArn'
        >)
      | ({ readonly __typename: 'OperationError' } & Pick<
          Types.OperationError,
          'message' | 'name' | 'context'
        >)
    >
  }
}
export const EventRuleStatusOmicsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'EventRuleStatusOmics' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'admin' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'eventRuleStatus' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  EventRuleStatusOmicsQuery,
  EventRuleStatusOmicsQueryVariables
>
export { EventRuleStatusOmicsDocument as default }
