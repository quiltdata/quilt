/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

import {
  BucketPermissionSelection_PolicyBucketPermission_Fragment,
  BucketPermissionSelection_RoleBucketPermission_Fragment,
  BucketPermissionSelectionFragmentDoc,
} from './BucketPermissionSelection.generated'

export type PolicySelectionFragment = { readonly __typename: 'Policy' } & Pick<
  Types.Policy,
  'id' | 'title' | 'arn' | 'managed'
> & {
    readonly permissions: ReadonlyArray<
      {
        readonly __typename: 'PolicyBucketPermission'
      } & BucketPermissionSelection_PolicyBucketPermission_Fragment
    >
    readonly roles: ReadonlyArray<
      { readonly __typename: 'ManagedRole' } & Pick<
        Types.ManagedRole,
        'id' | 'name' | 'arn'
      > & {
          readonly permissions: ReadonlyArray<
            {
              readonly __typename: 'RoleBucketPermission'
            } & BucketPermissionSelection_RoleBucketPermission_Fragment
          >
          readonly policies: ReadonlyArray<
            { readonly __typename: 'Policy' } & Pick<Types.Policy, 'id'>
          >
        }
    >
  }

export const PolicySelectionFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PolicySelection' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Policy' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
          { kind: 'Field', name: { kind: 'Name', value: 'id' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'arn' } },
          { kind: 'Field', name: { kind: 'Name', value: 'managed' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'permissions' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'BucketPermissionSelection' },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'roles' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
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
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'BucketPermissionSelection' },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'policies' },
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
    ...BucketPermissionSelectionFragmentDoc.definitions,
  ],
} as unknown as DocumentNode<PolicySelectionFragment, unknown>
