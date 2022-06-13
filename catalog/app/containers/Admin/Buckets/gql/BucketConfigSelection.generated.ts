/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type BucketConfigSelectionFragment = {
  readonly __typename: 'BucketConfig'
} & Pick<
  Types.BucketConfig,
  | 'name'
  | 'title'
  | 'iconUrl'
  | 'description'
  | 'relevanceScore'
  | 'overviewUrl'
  | 'tags'
  | 'linkedData'
  | 'fileExtensionsToIndex'
  | 'indexContentBytes'
  | 'scannerParallelShardsDepth'
  | 'snsNotificationArn'
  | 'skipMetaDataIndexing'
  | 'lastIndexed'
>

export const BucketConfigSelectionFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'BucketConfigSelection' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'BucketConfig' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: 'name' } },
          { kind: 'Field', name: { kind: 'Name', value: 'title' } },
          { kind: 'Field', name: { kind: 'Name', value: 'iconUrl' } },
          { kind: 'Field', name: { kind: 'Name', value: 'description' } },
          { kind: 'Field', name: { kind: 'Name', value: 'relevanceScore' } },
          { kind: 'Field', name: { kind: 'Name', value: 'overviewUrl' } },
          { kind: 'Field', name: { kind: 'Name', value: 'tags' } },
          { kind: 'Field', name: { kind: 'Name', value: 'linkedData' } },
          { kind: 'Field', name: { kind: 'Name', value: 'fileExtensionsToIndex' } },
          { kind: 'Field', name: { kind: 'Name', value: 'indexContentBytes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'scannerParallelShardsDepth' } },
          { kind: 'Field', name: { kind: 'Name', value: 'snsNotificationArn' } },
          { kind: 'Field', name: { kind: 'Name', value: 'skipMetaDataIndexing' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lastIndexed' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<BucketConfigSelectionFragment, unknown>
