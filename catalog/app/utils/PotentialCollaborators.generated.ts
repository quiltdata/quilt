/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../model/graphql/types.generated'

export type utils_PotentialCollaboratorsQueryVariables = Types.Exact<{
  [key: string]: never
}>

export type utils_PotentialCollaboratorsQuery = { readonly __typename: 'Query' } & {
  readonly potentialCollaborators: ReadonlyArray<
    { readonly __typename: 'Collaborator' } & Pick<
      Types.Collaborator,
      'email' | 'username'
    >
  >
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
