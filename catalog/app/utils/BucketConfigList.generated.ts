/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../model/graphql/types.generated'

export type utils_BucketConfigListQueryVariables = Types.Exact<{ [key: string]: never }>

export type utils_BucketConfigListQuery = { readonly __typename: 'Query' } & {
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
    > & {
        readonly collaborators: ReadonlyArray<
          { readonly __typename: 'CollaboratorBucketConnection' } & Pick<
            Types.CollaboratorBucketConnection,
            'permissionLevel'
          > & {
              readonly collaborator: { readonly __typename: 'Collaborator' } & Pick<
                Types.Collaborator,
                'email' | 'username'
              >
            }
        >
      }
  >
}

export const utils_BucketConfigListDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'utils_BucketConfigList' },
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
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'collaborators' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'collaborator' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'email' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'username' } },
                          ],
                        },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'permissionLevel' } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  utils_BucketConfigListQuery,
  utils_BucketConfigListQueryVariables
>

export { utils_BucketConfigListDocument as default }
