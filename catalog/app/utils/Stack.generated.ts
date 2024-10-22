/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../model/graphql/types.generated'

export type utils_StackQueryVariables = Types.Exact<{ [key: string]: never }>

export type utils_StackQuery = { readonly __typename: 'Query' } & {
  readonly stack: { readonly __typename: 'Stack' } & Pick<Types.Stack, 'version'>
}

export const utils_StackDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'utils_Stack' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'stack' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'version' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<utils_StackQuery, utils_StackQueryVariables>

export { utils_StackDocument as default }
