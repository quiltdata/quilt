/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type BucketPermissionLevel = 'READ' | 'READ_WRITE'

export interface UnmanagedPolicyInput {
  readonly arn: string
  readonly roles: Array<string | number>
  readonly title: string
}

export type containers_Admin_UsersAndRoles_gql_PolicyCreateUnmanagedMutationVariables =
  Exact<{
    input: Types.UnmanagedPolicyInput
  }>

export interface containers_Admin_UsersAndRoles_gql_PolicyCreateUnmanagedMutation {
  readonly __typename: 'Mutation'
  readonly policyCreate:
    | {
        readonly __typename: 'InvalidInput'
        readonly errors: ReadonlyArray<{
          readonly __typename: 'InputError'
          readonly path: string | null
          readonly message: string
        }>
      }
    | { readonly __typename: 'OperationError'; readonly message: string }
    | {
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
}

export const containers_Admin_UsersAndRoles_gql_PolicyCreateUnmanagedDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {
        kind: 'Name',
        value: 'containers_Admin_UsersAndRoles_gql_PolicyCreateUnmanaged',
      },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'input' } },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'UnmanagedPolicyInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            alias: { kind: 'Name', value: 'policyCreate' },
            name: { kind: 'Name', value: 'policyCreateUnmanaged' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'input' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'PolicyResultSelection' },
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
      name: { kind: 'Name', value: 'PolicyResultSelection' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'PolicyResult' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
          {
            kind: 'InlineFragment',
            typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Policy' } },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'PolicySelection' },
                },
              ],
            },
          },
          {
            kind: 'InlineFragment',
            typeCondition: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'InvalidInput' },
            },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'errors' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'path' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'InlineFragment',
            typeCondition: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'OperationError' },
            },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'message' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  containers_Admin_UsersAndRoles_gql_PolicyCreateUnmanagedMutation,
  containers_Admin_UsersAndRoles_gql_PolicyCreateUnmanagedMutationVariables
>

export { containers_Admin_UsersAndRoles_gql_PolicyCreateUnmanagedDocument as default }
