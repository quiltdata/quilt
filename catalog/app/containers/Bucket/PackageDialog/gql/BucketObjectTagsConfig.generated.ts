/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../../model/graphql/types.generated'

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type containers_Bucket_PackageDialog_gql_BucketObjectTagsConfigQueryVariables =
  Exact<{
    bucket: string
  }>

export interface containers_Bucket_PackageDialog_gql_BucketObjectTagsConfigQuery {
  readonly __typename: 'Query'
  readonly bucketConfig: {
    readonly __typename: 'BucketConfig'
    readonly name: string
    readonly objectTagsConfig: string | null
  } | null
}

export const containers_Bucket_PackageDialog_gql_BucketObjectTagsConfigDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {
        kind: 'Name',
        value: 'containers_Bucket_PackageDialog_gql_BucketObjectTagsConfig',
      },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'bucket' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'bucketConfig' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'name' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'bucket' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'objectTagsConfig' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  containers_Bucket_PackageDialog_gql_BucketObjectTagsConfigQuery,
  containers_Bucket_PackageDialog_gql_BucketObjectTagsConfigQueryVariables
>

export { containers_Bucket_PackageDialog_gql_BucketObjectTagsConfigDocument as default }
