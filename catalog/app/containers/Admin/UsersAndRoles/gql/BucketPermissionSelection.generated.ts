/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../../model/graphql/types.generated'

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type BucketPermissionLevel = 'READ' | 'READ_WRITE'

export type BucketPermissionSelection_PolicyBucketPermission_Fragment = {
  readonly __typename: 'PolicyBucketPermission'
  readonly level: Types.BucketPermissionLevel
  readonly bucket: {
    readonly __typename: 'BucketConfig'
    readonly name: string
    readonly title: string
    readonly iconUrl: string | null
  }
}

export type BucketPermissionSelection_RoleBucketPermission_Fragment = {
  readonly __typename: 'RoleBucketPermission'
  readonly level: Types.BucketPermissionLevel
  readonly bucket: {
    readonly __typename: 'BucketConfig'
    readonly name: string
    readonly title: string
    readonly iconUrl: string | null
  }
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
