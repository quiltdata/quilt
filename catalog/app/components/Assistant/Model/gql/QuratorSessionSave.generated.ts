/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../../model/graphql/types.generated'

import type { JsonRecord } from 'utils/types'
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
/** The session rendered as package files, saved as a new revision of its package. */
export interface QuratorSessionCheckpointInput {
  readonly readme: string
  readonly session: JsonRecord
  readonly transcript: string
}

/**
 * Omit `id` to create a session. With `id`, `baseVersion` must be the version the
 * caller last read, or the save is refused as `Conflict`.
 */
export interface QuratorSessionSaveInput {
  readonly baseVersion: number | null | undefined
  /** At most 2 MiB, or the save is refused as `TooLarge`. */
  readonly checkpoint: QuratorSessionCheckpointInput | null | undefined
  readonly events: JsonRecord
  readonly id: string | number | null | undefined
  readonly title: string
}

export type components_Assistant_Model_gql_QuratorSessionSaveMutationVariables = Exact<{
  input: Types.QuratorSessionSaveInput
}>

export interface components_Assistant_Model_gql_QuratorSessionSaveMutation {
  readonly __typename: 'Mutation'
  readonly quratorSessionSave:
    | {
        readonly __typename: 'InvalidInput'
        readonly errors: ReadonlyArray<{
          readonly __typename: 'InputError'
          readonly name: string
          readonly context: JsonRecord | null
        }>
      }
    | { readonly __typename: 'OperationError'; readonly name: string }
    | {
        readonly __typename: 'QuratorSession'
        readonly id: string
        readonly version: number
        readonly package: {
          readonly __typename: 'QuratorSessionPackage'
          readonly revisedAt: Date
        } | null
      }
}

export const components_Assistant_Model_gql_QuratorSessionSaveDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'components_Assistant_Model_gql_QuratorSessionSave' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'input' } },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'QuratorSessionSaveInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'quratorSessionSave' },
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
                    name: { kind: 'Name', value: 'QuratorSession' },
                  },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'version' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'package' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'revisedAt' } },
                          ],
                        },
                      },
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
                            { kind: 'Field', name: { kind: 'Name', value: 'context' } },
                          ],
                        },
                      },
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
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
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
  components_Assistant_Model_gql_QuratorSessionSaveMutation,
  components_Assistant_Model_gql_QuratorSessionSaveMutationVariables
>

export { components_Assistant_Model_gql_QuratorSessionSaveDocument as default }
