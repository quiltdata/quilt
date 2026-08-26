/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../../model/graphql/types.generated'

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type BucketConfigSelectionFragment = {
  readonly __typename: 'BucketConfig'
  readonly name: string
  readonly title: string
  readonly iconUrl: string | null
  readonly description: string | null
  readonly relevanceScore: number
  readonly tags: ReadonlyArray<string> | null
  readonly fileExtensionsToIndex: ReadonlyArray<string> | null
  readonly indexContentBytes: number | null
  readonly scannerParallelShardsDepth: number | null
  readonly snsNotificationArn: string | null
  readonly skipMetaDataIndexing: boolean | null
  readonly lastIndexed: Date | null
  readonly browsable: boolean
}

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
          { kind: 'Field', name: { kind: 'Name', value: 'tags' } },
          { kind: 'Field', name: { kind: 'Name', value: 'fileExtensionsToIndex' } },
          { kind: 'Field', name: { kind: 'Name', value: 'indexContentBytes' } },
          { kind: 'Field', name: { kind: 'Name', value: 'scannerParallelShardsDepth' } },
          { kind: 'Field', name: { kind: 'Name', value: 'snsNotificationArn' } },
          { kind: 'Field', name: { kind: 'Name', value: 'skipMetaDataIndexing' } },
          { kind: 'Field', name: { kind: 'Name', value: 'lastIndexed' } },
          { kind: 'Field', name: { kind: 'Name', value: 'browsable' } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<BucketConfigSelectionFragment, unknown>
