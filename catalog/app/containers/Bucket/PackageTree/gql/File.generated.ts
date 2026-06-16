/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import type { JsonRecord } from 'utils/types'
import * as Types from '../../../../model/graphql/types.generated'

export type containers_Bucket_PackageTree_gql_FileQueryVariables = Exact<{
  bucket: string
  name: string
  hash: string
  path: string
}>

export interface containers_Bucket_PackageTree_gql_FileQuery {
  readonly __typename: 'Query'
  readonly package: {
    readonly __typename: 'Package'
    readonly bucket: string
    readonly name: string
    readonly revision: {
      readonly __typename: 'PackageRevision'
      readonly hash: string
      readonly modified: Date
      readonly file: {
        readonly __typename: 'PackageFile'
        readonly path: string
        readonly metadata: JsonRecord | null
        readonly size: number
        readonly physicalKey: string
      } | null
      readonly dir: { readonly __typename: 'PackageDir'; readonly path: string } | null
    } | null
  } | null
}

export const containers_Bucket_PackageTree_gql_FileDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Bucket_PackageTree_gql_File' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'bucket' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'name' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'hash' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'path' } },
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
            name: { kind: 'Name', value: 'package' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'bucket' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'bucket' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'name' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'name' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'bucket' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'revision' },
                  arguments: [
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'hashOrTag' },
                      value: { kind: 'Variable', name: { kind: 'Name', value: 'hash' } },
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'hash' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'modified' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'file' },
                        arguments: [
                          {
                            kind: 'Argument',
                            name: { kind: 'Name', value: 'path' },
                            value: {
                              kind: 'Variable',
                              name: { kind: 'Name', value: 'path' },
                            },
                          },
                        ],
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'path' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'metadata' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'size' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'physicalKey' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'dir' },
                        arguments: [
                          {
                            kind: 'Argument',
                            name: { kind: 'Name', value: 'path' },
                            value: {
                              kind: 'Variable',
                              name: { kind: 'Name', value: 'path' },
                            },
                          },
                        ],
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'path' } },
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
      },
    },
  ],
} as unknown as DocumentNode<
  containers_Bucket_PackageTree_gql_FileQuery,
  containers_Bucket_PackageTree_gql_FileQueryVariables
>

export { containers_Bucket_PackageTree_gql_FileDocument as default }
