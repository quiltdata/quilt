/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type BucketPermissionLevel = 'READ' | 'READ_WRITE'

export type PolicySelectionFragment = {
  readonly __typename: 'Policy'
  readonly id: string
  readonly title: string
  readonly arn: string
  readonly managed: boolean
  readonly permissions: ReadonlyArray<{
    readonly __typename: 'PolicyBucketPermission'
    readonly level: Types.BucketPermissionLevel
    readonly bucket: {
      readonly __typename: 'BucketConfig'
      readonly name: string
      readonly title: string
      readonly iconUrl: string | null
    }
  }>
  readonly roles: ReadonlyArray<{
    readonly __typename: 'ManagedRole'
    readonly id: string
    readonly name: string
    readonly arn: string
    readonly permissions: ReadonlyArray<{
      readonly __typename: 'RoleBucketPermission'
      readonly level: Types.BucketPermissionLevel
      readonly bucket: {
        readonly __typename: 'BucketConfig'
        readonly name: string
        readonly title: string
        readonly iconUrl: string | null
      }
    }>
    readonly policies: ReadonlyArray<{
      readonly __typename: 'Policy'
      readonly id: string
    }>
  }>
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
} as unknown as DocumentNode<PolicySelectionFragment, unknown>
