/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type RoleSelection_UnmanagedRole_Fragment = {
  readonly __typename: 'UnmanagedRole'
} & Pick<Types.UnmanagedRole, 'id' | 'name' | 'arn'>

export type RoleSelection_ManagedRole_Fragment = {
  readonly __typename: 'ManagedRole'
} & Pick<Types.ManagedRole, 'id' | 'name' | 'arn'> & {
    readonly permissions: ReadonlyArray<
      { readonly __typename: 'RoleBucketPermission' } & Pick<
        Types.RoleBucketPermission,
        'level'
      > & {
          readonly bucket: { readonly __typename: 'BucketConfig' } & Pick<
            Types.BucketConfig,
            'name'
          >
        }
    >
  }

export type RoleSelectionFragment =
  | RoleSelection_UnmanagedRole_Fragment
  | RoleSelection_ManagedRole_Fragment

export const RoleSelectionFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'RoleSelection' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Role' } },
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
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'arn' } },
              ],
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
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'arn' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'permissions' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'bucket' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                          ],
                        },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'level' } },
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
} as unknown as DocumentNode<RoleSelectionFragment, unknown>
