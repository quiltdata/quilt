/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type containers_Admin_UsersAndRoles_gql_BucketsQueryVariables = Exact<{
  [key: string]: never
}>

export interface containers_Admin_UsersAndRoles_gql_BucketsQuery {
  readonly __typename: 'Query'
  readonly buckets: ReadonlyArray<{
    readonly __typename: 'BucketConfig'
    readonly name: string
    readonly title: string
    readonly iconUrl: string | null
  }>
}

export const containers_Admin_UsersAndRoles_gql_BucketsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Admin_UsersAndRoles_gql_Buckets' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            alias: { kind: 'Name', value: 'buckets' },
            name: { kind: 'Name', value: 'bucketConfigs' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                { kind: 'Field', name: { kind: 'Name', value: 'iconUrl' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  containers_Admin_UsersAndRoles_gql_BucketsQuery,
  containers_Admin_UsersAndRoles_gql_BucketsQueryVariables
>

export { containers_Admin_UsersAndRoles_gql_BucketsDocument as default }
