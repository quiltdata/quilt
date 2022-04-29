/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../model/graphql/types.generated'

export type utils_BucketConfigListNoCollaboratorsQueryVariables = Types.Exact<{
  [key: string]: never
}>

export type utils_BucketConfigListNoCollaboratorsQuery = {
  readonly __typename: 'Query'
} & {
  readonly bucketConfigs: ReadonlyArray<
    { readonly __typename: 'BucketConfig' } & Pick<
      Types.BucketConfig,
      | 'name'
      | 'title'
      | 'iconUrl'
      | 'description'
      | 'linkedData'
      | 'overviewUrl'
      | 'tags'
      | 'relevanceScore'
    >
  >
}

export const utils_BucketConfigListNoCollaboratorsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'utils_BucketConfigListNoCollaborators' },
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
                { kind: 'Field', name: { kind: 'Name', value: 'iconUrl' } },
                { kind: 'Field', name: { kind: 'Name', value: 'description' } },
                { kind: 'Field', name: { kind: 'Name', value: 'linkedData' } },
                { kind: 'Field', name: { kind: 'Name', value: 'overviewUrl' } },
                { kind: 'Field', name: { kind: 'Name', value: 'tags' } },
                { kind: 'Field', name: { kind: 'Name', value: 'relevanceScore' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  utils_BucketConfigListNoCollaboratorsQuery,
  utils_BucketConfigListNoCollaboratorsQueryVariables
>

export { utils_BucketConfigListNoCollaboratorsDocument as default }
