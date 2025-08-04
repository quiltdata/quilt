/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type UserSelectionFragment = { readonly __typename: 'User' } & Pick<
  Types.User,
  | 'name'
  | 'email'
  | 'dateJoined'
  | 'lastLogin'
  | 'isActive'
  | 'isAdmin'
  | 'isSsoOnly'
  | 'isService'
  | 'isRoleAssignmentDisabled'
  | 'isAdminAssignmentDisabled'
> & {
    readonly role: Types.Maybe<
      | ({ readonly __typename: 'UnmanagedRole' } & Pick<
          Types.UnmanagedRole,
          'id' | 'name'
        >)
      | ({ readonly __typename: 'ManagedRole' } & Pick<Types.ManagedRole, 'id' | 'name'>)
    >
    readonly extraRoles: ReadonlyArray<
      | ({ readonly __typename: 'UnmanagedRole' } & Pick<
          Types.UnmanagedRole,
          'id' | 'name'
        >)
      | ({ readonly __typename: 'ManagedRole' } & Pick<Types.ManagedRole, 'id' | 'name'>)
    >
  }

export const UserSelectionFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'UserSelection' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'email' } },
          { kind: 'Field', name: { kind: 'Name', value: 'dateJoined' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lastLogin' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isActive' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isAdmin' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isSsoOnly' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isService' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isRoleAssignmentDisabled' } },
          { kind: 'Field', name: { kind: 'Name', value: 'isAdminAssignmentDisabled' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'role' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
                {
                  kind: 'InlineFragment',
                  typeCondition: {
                    kind: 'NamedType',
                    name: { kind: 'Name', value: 'ManagedRole' },
                  },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                    ],
                  },
                },
                {
                  kind: 'InlineFragment',
                  typeCondition: {
                    kind: 'NamedType',
                    name: { kind: 'Name', value: 'UnmanagedRole' },
                  },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'extraRoles' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
                {
                  kind: 'InlineFragment',
                  typeCondition: {
                    kind: 'NamedType',
                    name: { kind: 'Name', value: 'ManagedRole' },
                  },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                    ],
                  },
                },
                {
                  kind: 'InlineFragment',
                  typeCondition: {
                    kind: 'NamedType',
                    name: { kind: 'Name', value: 'UnmanagedRole' },
                  },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
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
} as unknown as DocumentNode<UserSelectionFragment, unknown>
