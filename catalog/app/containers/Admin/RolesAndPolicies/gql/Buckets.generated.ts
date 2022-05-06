/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type containers_Admin_RolesAndPolicies_gql_BucketsQueryVariables = Types.Exact<{
  [key: string]: never
}>

export type containers_Admin_RolesAndPolicies_gql_BucketsQuery = {
  readonly __typename: 'Query'
} & {
  readonly buckets: ReadonlyArray<
    { readonly __typename: 'BucketConfig' } & Pick<
      Types.BucketConfig,
      'name' | 'title' | 'iconUrl'
    >
  >
}

export const containers_Admin_RolesAndPolicies_gql_BucketsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Admin_RolesAndPolicies_gql_Buckets' },
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
  containers_Admin_RolesAndPolicies_gql_BucketsQuery,
  containers_Admin_RolesAndPolicies_gql_BucketsQueryVariables
>

export { containers_Admin_RolesAndPolicies_gql_BucketsDocument as default }
