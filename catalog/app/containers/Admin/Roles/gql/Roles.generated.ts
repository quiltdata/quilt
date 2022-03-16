/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

import {
  RoleSelection_UnmanagedRole_Fragment,
  RoleSelection_ManagedRole_Fragment,
  RoleSelectionFragmentDoc,
} from './RoleSelection.generated'

export type containers_Admin_Roles_gql_RolesQueryVariables = Types.Exact<{
  [key: string]: never
}>

export type containers_Admin_Roles_gql_RolesQuery = { readonly __typename: 'Query' } & {
  readonly roles: ReadonlyArray<
    | ({ readonly __typename: 'UnmanagedRole' } & RoleSelection_UnmanagedRole_Fragment)
    | ({ readonly __typename: 'ManagedRole' } & RoleSelection_ManagedRole_Fragment)
  >
  readonly defaultRole: Types.Maybe<
    | ({ readonly __typename: 'UnmanagedRole' } & Pick<Types.UnmanagedRole, 'id'>)
    | ({ readonly __typename: 'ManagedRole' } & Pick<Types.ManagedRole, 'id'>)
  >
}

export const containers_Admin_Roles_gql_RolesDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Admin_Roles_gql_Roles' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'roles' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'RoleSelection' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'defaultRole' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
                {
                  kind: 'InlineFragment',
                  typeCondition: {
                    kind: 'NamedType',
                    name: { kind: 'Name', value: 'UnmanagedRole' },
                  },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [{ kind: 'Field', name: { kind: 'Name', value: 'id' } }],
                  },
                },
                {
                  kind: 'InlineFragment',
                  typeCondition: {
                    kind: 'NamedType',
                    name: { kind: 'Name', value: 'ManagedRole' },
                  },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [{ kind: 'Field', name: { kind: 'Name', value: 'id' } }],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    ...RoleSelectionFragmentDoc.definitions,
  ],
} as unknown as DocumentNode<
  containers_Admin_Roles_gql_RolesQuery,
  containers_Admin_Roles_gql_RolesQueryVariables
>

export { containers_Admin_Roles_gql_RolesDocument as default }
