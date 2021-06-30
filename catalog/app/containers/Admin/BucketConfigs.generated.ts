/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../model/graphql/types.generated'

import {
  BucketConfigSelectionFragment,
  BucketConfigSelectionFragmentDoc,
} from './BucketConfigSelection.generated'

export type containers_Admin_BucketConfigsQueryVariables = Types.Exact<{
  [key: string]: never
}>

export type containers_Admin_BucketConfigsQuery = { readonly __typename: 'Query' } & {
  readonly bucketConfigs: ReadonlyArray<
    { readonly __typename: 'BucketConfig' } & BucketConfigSelectionFragment
  >
}

export const containers_Admin_BucketConfigsDocument = ({
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Admin_BucketConfigs' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'bucketConfigs' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'BucketConfigSelection' },
                },
              ],
            },
          },
        ],
      },
    },
    ...BucketConfigSelectionFragmentDoc.definitions,
  ],
} as unknown) as DocumentNode<
  containers_Admin_BucketConfigsQuery,
  containers_Admin_BucketConfigsQueryVariables
>

export { containers_Admin_BucketConfigsDocument as default }
