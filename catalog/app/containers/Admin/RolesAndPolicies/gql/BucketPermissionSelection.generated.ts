/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type BucketPermissionSelection_PolicyBucketPermission_Fragment = {
  readonly __typename: 'PolicyBucketPermission'
} & Pick<Types.PolicyBucketPermission, 'level'> & {
    readonly bucket: { readonly __typename: 'BucketConfig' } & Pick<
      Types.BucketConfig,
      'name' | 'title' | 'iconUrl'
    >
  }

export type BucketPermissionSelection_RoleBucketPermission_Fragment = {
  readonly __typename: 'RoleBucketPermission'
} & Pick<Types.RoleBucketPermission, 'level'> & {
    readonly bucket: { readonly __typename: 'BucketConfig' } & Pick<
      Types.BucketConfig,
      'name' | 'title' | 'iconUrl'
    >
  }

export type BucketPermissionSelectionFragment =
  | BucketPermissionSelection_PolicyBucketPermission_Fragment
  | BucketPermissionSelection_RoleBucketPermission_Fragment

export const BucketPermissionSelectionFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'BucketPermissionSelection' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'BucketPermission' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'bucket' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                { kind: 'Field', name: { kind: 'Name', value: 'iconUrl' } },
              ],
            },
          },
          { kind: 'Field', name: { kind: 'Name', value: 'level' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<BucketPermissionSelectionFragment, unknown>
