/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../model/graphql/types.generated'

export type containers_Admin_RolesBucketsQueryVariables = Types.Exact<{
  [key: string]: never
}>

export type containers_Admin_RolesBucketsQuery = { readonly __typename: 'Query' } & {
  readonly buckets: ReadonlyArray<
    { readonly __typename: 'BucketConfig' } & Pick<Types.BucketConfig, 'name'>
  >
}

export const containers_Admin_RolesBucketsDocument = ({
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Admin_RolesBuckets' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            alias: { kind: 'Name', value: 'buckets' },
            name: { kind: 'Name', value: 'bucketConfigs' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'name' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown) as DocumentNode<
  containers_Admin_RolesBucketsQuery,
  containers_Admin_RolesBucketsQueryVariables
>

export { containers_Admin_RolesBucketsDocument as default }
