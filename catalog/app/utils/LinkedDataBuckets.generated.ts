/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../model/graphql/types.generated'

export type utils_LinkedDataBucketsQueryVariables = Types.Exact<{
  bucket: Types.Scalars['String']
}>

export type utils_LinkedDataBucketsQuery = { readonly __typename: 'Query' } & {
  readonly bucketConfig: Types.Maybe<
    { readonly __typename: 'BucketConfig' } & Pick<
      Types.BucketConfig,
      'name' | 'title' | 'description' | 'tags' | 'linkedData'
    >
  >
}

export const utils_LinkedDataBucketsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'utils_LinkedDataBuckets' },
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
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                { kind: 'Field', name: { kind: 'Name', value: 'description' } },
                { kind: 'Field', name: { kind: 'Name', value: 'tags' } },
                { kind: 'Field', name: { kind: 'Name', value: 'linkedData' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  utils_LinkedDataBucketsQuery,
  utils_LinkedDataBucketsQueryVariables
>

export { utils_LinkedDataBucketsDocument as default }
