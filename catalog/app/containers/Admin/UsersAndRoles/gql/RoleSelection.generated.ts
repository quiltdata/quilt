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
    readonly policies: ReadonlyArray<
      { readonly __typename: 'Policy' } & Pick<
        Types.Policy,
        'id' | 'title' | 'managed'
      > & {
          readonly permissions: ReadonlyArray<
            { readonly __typename: 'PolicyBucketPermission' } & Pick<
              Types.PolicyBucketPermission,
              'level'
            > & {
                readonly bucket: { readonly __typename: 'BucketConfig' } & Pick<
                  Types.BucketConfig,
                  'name'
                >
              }
          >
          readonly roles: ReadonlyArray<
            { readonly __typename: 'ManagedRole' } & Pick<Types.ManagedRole, 'id'>
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
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'policies' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'managed' } },
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
                                  {
                                    kind: 'Field',
                                    name: { kind: 'Name', value: 'name' },
                                  },
                                ],
                              },
                            },
                            { kind: 'Field', name: { kind: 'Name', value: 'level' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'roles' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'id' } },
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
} as unknown as DocumentNode<RoleSelectionFragment, unknown>
