/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../model/graphql/types.generated'

export type utils_HasUnmanagedRoleQueryVariables = Types.Exact<{ [key: string]: never }>

export type utils_HasUnmanagedRoleQuery = { readonly __typename: 'Query' } & Pick<
  Types.Query,
  'hasUnmanagedRoles'
>

export const utils_HasUnmanagedRoleDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'utils_HasUnmanagedRole' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'hasUnmanagedRoles' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  utils_HasUnmanagedRoleQuery,
  utils_HasUnmanagedRoleQueryVariables
>

export { utils_HasUnmanagedRoleDocument as default }
