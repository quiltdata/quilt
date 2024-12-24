/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type containers_Admin_Buckets_gql_ContentIndexingSettingsQueryVariables =
  Types.Exact<{ [key: string]: never }>

export type containers_Admin_Buckets_gql_ContentIndexingSettingsQuery = {
  readonly __typename: 'Query'
} & {
  readonly config: { readonly __typename: 'Config' } & {
    readonly contentIndexingSettings: {
      readonly __typename: 'ContentIndexingSettings'
    } & Pick<
      Types.ContentIndexingSettings,
      'extensions' | 'bytesDefault' | 'bytesMin' | 'bytesMax'
    >
  }
}

export const containers_Admin_Buckets_gql_ContentIndexingSettingsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {
        kind: 'Name',
        value: 'containers_Admin_Buckets_gql_ContentIndexingSettings',
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'config' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'contentIndexingSettings' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'extensions' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'bytesDefault' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'bytesMin' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'bytesMax' } },
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
  containers_Admin_Buckets_gql_ContentIndexingSettingsQuery,
  containers_Admin_Buckets_gql_ContentIndexingSettingsQueryVariables
>

export { containers_Admin_Buckets_gql_ContentIndexingSettingsDocument as default }
