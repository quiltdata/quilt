/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import type { JsonRecord } from 'utils/types'
import type { PackageContentsFlatMap } from 'model'
import * as Types from '../../../../model/graphql/types.generated'

export type containers_Bucket_PackageDialog_gql_ManifestQueryVariables = Exact<{
  bucket: string
  name: string
  hashOrTag: string
  max: number
  skipEntries: boolean
}>

export interface containers_Bucket_PackageDialog_gql_ManifestQuery {
  readonly __typename: 'Query'
  readonly package: {
    readonly __typename: 'Package'
    readonly bucket: string
    readonly name: string
    readonly revision: {
      readonly __typename: 'PackageRevision'
      readonly hash: string
      readonly modified: Date
      readonly userMeta: JsonRecord | null
      readonly contentsFlatMap?: PackageContentsFlatMap | null
      readonly workflow: {
        readonly __typename: 'PackageWorkflow'
        readonly id: string | null
      } | null
    } | null
  } | null
}

export const containers_Bucket_PackageDialog_gql_ManifestDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Bucket_PackageDialog_gql_Manifest' },
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
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'hashOrTag' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'max' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'skipEntries' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
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
                      value: {
                        kind: 'Variable',
                        name: { kind: 'Name', value: 'hashOrTag' },
                      },
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'hash' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'modified' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'userMeta' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'workflow' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'contentsFlatMap' },
                        arguments: [
                          {
                            kind: 'Argument',
                            name: { kind: 'Name', value: 'max' },
                            value: {
                              kind: 'Variable',
                              name: { kind: 'Name', value: 'max' },
                            },
                          },
                        ],
                        directives: [
                          {
                            kind: 'Directive',
                            name: { kind: 'Name', value: 'skip' },
                            arguments: [
                              {
                                kind: 'Argument',
                                name: { kind: 'Name', value: 'if' },
                                value: {
                                  kind: 'Variable',
                                  name: { kind: 'Name', value: 'skipEntries' },
                                },
                              },
                            ],
                          },
                        ],
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
  containers_Bucket_PackageDialog_gql_ManifestQuery,
  containers_Bucket_PackageDialog_gql_ManifestQueryVariables
>

export { containers_Bucket_PackageDialog_gql_ManifestDocument as default }
