/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../../model/graphql/types.generated'

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type components_Assistant_Model_gql_QuratorSessionsSetEnabledMutationVariables =
  Exact<{
    enabled: boolean
  }>

export interface components_Assistant_Model_gql_QuratorSessionsSetEnabledMutation {
  readonly __typename: 'Mutation'
  readonly quratorSessionsSetEnabled:
    | { readonly __typename: 'InvalidInput' }
    | { readonly __typename: 'Ok' }
    | { readonly __typename: 'OperationError' }
}

export const components_Assistant_Model_gql_QuratorSessionsSetEnabledDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {
        kind: 'Name',
        value: 'components_Assistant_Model_gql_QuratorSessionsSetEnabled',
      },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'enabled' } },
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
            name: { kind: 'Name', value: 'quratorSessionsSetEnabled' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'enabled' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'enabled' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  components_Assistant_Model_gql_QuratorSessionsSetEnabledMutation,
  components_Assistant_Model_gql_QuratorSessionsSetEnabledMutationVariables
>

export { components_Assistant_Model_gql_QuratorSessionsSetEnabledDocument as default }
