/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../model/graphql/types.generated'

export type containers_Bucket_OverviewBucketConfigQueryVariables = Types.Exact<{
  bucket: Types.Scalars['String']
}>

export type containers_Bucket_OverviewBucketConfigQuery = {
  readonly __typename: 'Query'
} & {
  readonly bucketConfig: Types.Maybe<
    { readonly __typename: 'BucketConfig' } & Pick<
      Types.BucketConfig,
      'name' | 'description' | 'overviewUrl'
    >
  >
}

export const containers_Bucket_OverviewBucketConfigDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Bucket_OverviewBucketConfig' },
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
                { kind: 'Field', name: { kind: 'Name', value: 'description' } },
                { kind: 'Field', name: { kind: 'Name', value: 'overviewUrl' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  containers_Bucket_OverviewBucketConfigQuery,
  containers_Bucket_OverviewBucketConfigQueryVariables
>

export { containers_Bucket_OverviewBucketConfigDocument as default }
