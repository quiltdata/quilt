/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../model/graphql/types.generated'

export type BucketDiscoveryQueryVariables = Types.Exact<{ [key: string]: never }>

export type BucketDiscoveryQuery = { readonly __typename: 'Query' } & {
  readonly bucketConfigs: ReadonlyArray<
    { readonly __typename: 'BucketConfig' } & Pick<
      Types.BucketConfig,
      'name' | 'title' | 'description' | 'tags' | 'relevanceScore' | 'lastIndexed'
    >
  >
}

export const BucketDiscoveryDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'BucketDiscovery' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'bucketConfigs' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                { kind: 'Field', name: { kind: 'Name', value: 'description' } },
                { kind: 'Field', name: { kind: 'Name', value: 'tags' } },
                { kind: 'Field', name: { kind: 'Name', value: 'relevanceScore' } },
                { kind: 'Field', name: { kind: 'Name', value: 'lastIndexed' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<BucketDiscoveryQuery, BucketDiscoveryQueryVariables>

export { BucketDiscoveryDocument as default }
