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

/**
 * `to` must be one of CONTEXTUALIZED, QUALIFIED, REVIEWED, SUBMITTED or ELIGIBLE —
 * the only edges this mutation drives. The job record and the promoter apply the
 * other edges from registry code; no caller reaches those through GraphQL.
 */
export interface AttemptTransitionInput {
  /** The version last read; a stale value is refused as `Conflict`. */
  readonly baseVersion: number
  readonly challenge: string
  readonly to: AttemptState
}

export type containers_Attempt_gql_TransitionMutationVariables = Exact<{
  input: Types.AttemptTransitionInput
}>

export interface containers_Attempt_gql_TransitionMutation {
  readonly __typename: 'Mutation'
  readonly attemptTransition:
    | {
        readonly __typename: 'Attempt'
        readonly id: string
        readonly challenge: string
        readonly state: Types.AttemptState
        readonly version: number
      }
    | {
        readonly __typename: 'InvalidInput'
        readonly errors: ReadonlyArray<{
          readonly __typename: 'InputError'
          readonly name: string
          readonly path: string | null
          readonly message: string
        }>
      }
}

export const containers_Attempt_gql_TransitionDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'containers_Attempt_gql_Transition' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'input' } },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'AttemptTransitionInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'attemptTransition' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'input' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
                {
                  kind: 'InlineFragment',
                  typeCondition: {
                    kind: 'NamedType',
                    name: { kind: 'Name', value: 'Attempt' },
                  },
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
                {
                  kind: 'InlineFragment',
                  typeCondition: {
                    kind: 'NamedType',
                    name: { kind: 'Name', value: 'InvalidInput' },
                  },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'errors' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'path' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'message' } },
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
  containers_Attempt_gql_TransitionMutation,
  containers_Attempt_gql_TransitionMutationVariables
>

export { containers_Attempt_gql_TransitionDocument as default }
