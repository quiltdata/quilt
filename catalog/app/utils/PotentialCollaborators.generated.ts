/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../model/graphql/types.generated'

export type utils_PotentialCollaboratorsQueryVariables = Exact<{ [key: string]: never }>

export interface utils_PotentialCollaboratorsQuery {
  readonly __typename: 'Query'
  readonly potentialCollaborators: ReadonlyArray<{
    readonly __typename: 'Collaborator'
    readonly email: string
    readonly username: string
  }>
}

export const utils_PotentialCollaboratorsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'utils_PotentialCollaborators' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'potentialCollaborators' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'email' } },
                { kind: 'Field', name: { kind: 'Name', value: 'username' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  utils_PotentialCollaboratorsQuery,
  utils_PotentialCollaboratorsQueryVariables
>

export { utils_PotentialCollaboratorsDocument as default }
