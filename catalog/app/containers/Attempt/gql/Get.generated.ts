/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../model/graphql/types.generated'

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type AttemptState =
  | 'AUTHENTICATED'
  | 'CLAIMED'
  | 'CONTEXTUALIZED'
  | 'ELIGIBLE'
  | 'PROMOTED'
  | 'QUALIFIED'
  | 'REJECTED'
  | 'RESULT_READY'
  | 'REVIEWED'
  | 'RUNNING'
  | 'RUN_FAILED'
  | 'SUBMITTED'
  | 'VALIDATING'

export type containers_Attempt_gql_GetQueryVariables = Exact<{
  id: string | number
}>

export interface containers_Attempt_gql_GetQuery {
  readonly __typename: 'Query'
  readonly me: {
    readonly __typename: 'Me'
    readonly attempt: {
      readonly __typename: 'Attempt'
      readonly id: string
      readonly challenge: string
      readonly state: Types.AttemptState
      readonly version: number
    } | null
  } | null
}

export const containers_Attempt_gql_GetDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Attempt_gql_Get' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'me' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'attempt' },
                  arguments: [
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'id' },
                      value: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'challenge' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'state' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'version' } },
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
  containers_Attempt_gql_GetQuery,
  containers_Attempt_gql_GetQueryVariables
>

export { containers_Attempt_gql_GetDocument as default }
