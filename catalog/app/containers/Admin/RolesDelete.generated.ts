/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../model/graphql/types.generated'

export type containers_Admin_RolesDeleteMutationVariables = Types.Exact<{
  id: Types.Scalars['ID']
}>

export type containers_Admin_RolesDeleteMutation = { readonly __typename: 'Mutation' } & {
  readonly roleDelete:
    | { readonly __typename: 'RoleDeleteSuccess' }
    | { readonly __typename: 'RoleDoesNotExist' }
    | { readonly __typename: 'RoleNameReserved' }
}

export const containers_Admin_RolesDeleteDocument = ({
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'containers_Admin_RolesDelete' },
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
            name: { kind: 'Name', value: 'roleDelete' },
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
                { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown) as DocumentNode<
  containers_Admin_RolesDeleteMutation,
  containers_Admin_RolesDeleteMutationVariables
>

export { containers_Admin_RolesDeleteDocument as default }
