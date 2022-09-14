/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type containers_Bucket_PackageTree_gql_FileQueryVariables = Types.Exact<{
  bucket: Types.Scalars['String']
  name: Types.Scalars['String']
  hash: Types.Scalars['String']
  path: Types.Scalars['String']
}>

export type containers_Bucket_PackageTree_gql_FileQuery = {
  readonly __typename: 'Query'
} & {
  readonly package: Types.Maybe<
    { readonly __typename: 'Package' } & Pick<Types.Package, 'bucket' | 'name'> & {
        readonly revision: Types.Maybe<
          { readonly __typename: 'PackageRevision' } & Pick<
            Types.PackageRevision,
            'hash'
          > & {
              readonly file: Types.Maybe<
                { readonly __typename: 'PackageFile' } & Pick<
                  Types.PackageFile,
                  'path' | 'metadata' | 'size' | 'physicalKey'
                >
              >
            }
        >
      }
  >
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
