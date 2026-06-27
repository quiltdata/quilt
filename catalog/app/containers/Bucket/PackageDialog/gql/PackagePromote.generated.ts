/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../../model/graphql/types.generated'

import type { JsonRecord } from 'utils/types'
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export interface PackagePromoteSource {
  readonly bucket: string
  readonly hash: string
  readonly name: string
}

export interface PackagePushParams {
  readonly bucket: string
  readonly message: string | null | undefined
  readonly name: string
  readonly userMeta: JsonRecord | null | undefined
  readonly workflow: string | null | undefined
}

export type containers_Bucket_PackageDialog_gql_PackagePromoteMutationVariables = Exact<{
  params: Types.PackagePushParams
  src: Types.PackagePromoteSource
  destPrefix: string | null | undefined
}>

export interface containers_Bucket_PackageDialog_gql_PackagePromoteMutation {
  readonly __typename: 'Mutation'
  readonly packagePromote:
    | {
        readonly __typename: 'InvalidInput'
        readonly errors: ReadonlyArray<{
          readonly __typename: 'InputError'
          readonly path: string | null
          readonly message: string
        }>
      }
    | { readonly __typename: 'OperationError'; readonly message: string }
    | {
        readonly __typename: 'PackagePushSuccess'
        readonly package: {
          readonly __typename: 'Package'
          readonly bucket: string
          readonly name: string
          readonly modified: Date
          readonly revision: {
            readonly __typename: 'PackageRevision'
            readonly hash: string
            readonly modified: Date
          } | null
          readonly revisions: {
            readonly __typename: 'PackageRevisionList'
            readonly total: number
            readonly page: ReadonlyArray<{
              readonly __typename: 'PackageRevision'
              readonly hash: string
            }>
            readonly page1: ReadonlyArray<{
              readonly __typename: 'PackageRevision'
              readonly hash: string
            }>
          }
        }
        readonly revision: {
          readonly __typename: 'PackageRevision'
          readonly hash: string
          readonly modified: Date
          readonly message: string | null
          readonly metadata: JsonRecord
          readonly userMeta: JsonRecord | null
          readonly totalEntries: number | null
          readonly totalBytes: number | null
          readonly accessCounts: {
            readonly __typename: 'AccessCounts'
            readonly total: number
            readonly counts: ReadonlyArray<{
              readonly __typename: 'AccessCountForDate'
              readonly date: Date
              readonly value: number
            }>
          } | null
        }
      }
}

export const containers_Bucket_PackageDialog_gql_PackagePromoteDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'containers_Bucket_PackageDialog_gql_PackagePromote' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'params' } },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'PackagePushParams' },
            },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'src' } },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'PackagePromoteSource' },
            },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'destPrefix' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'packagePromote' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'params' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'params' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'src' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'src' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'destPrefix' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'destPrefix' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'PackagePushSuccessSelection' },
                },
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'InvalidInputSelection' },
                },
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'OperationErrorSelection' },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PackagePushSuccessSelection' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PackagePushSuccess' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'package' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'bucket' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'modified' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'revision' },
                  arguments: [
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'hashOrTag' },
                      value: { kind: 'StringValue', value: 'latest', block: false },
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'hash' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'modified' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'revisions' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'total' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'page' },
                        arguments: [
                          {
                            kind: 'Argument',
                            name: { kind: 'Name', value: 'number' },
                            value: { kind: 'IntValue', value: '1' },
                          },
                          {
                            kind: 'Argument',
                            name: { kind: 'Name', value: 'perPage' },
                            value: { kind: 'IntValue', value: '5' },
                          },
                        ],
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'hash' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        alias: { kind: 'Name', value: 'page1' },
                        name: { kind: 'Name', value: 'page' },
                        arguments: [
                          {
                            kind: 'Argument',
                            name: { kind: 'Name', value: 'number' },
                            value: { kind: 'IntValue', value: '1' },
                          },
                          {
                            kind: 'Argument',
                            name: { kind: 'Name', value: 'perPage' },
                            value: { kind: 'IntValue', value: '30' },
                          },
                        ],
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'hash' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'revision' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'hash' } },
                { kind: 'Field', name: { kind: 'Name', value: 'modified' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'metadata' } },
                { kind: 'Field', name: { kind: 'Name', value: 'userMeta' } },
                { kind: 'Field', name: { kind: 'Name', value: 'totalEntries' } },
                { kind: 'Field', name: { kind: 'Name', value: 'totalBytes' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'accessCounts' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'total' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'counts' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'date' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'value' } },
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
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'InvalidInputSelection' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'InvalidInput' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'errors' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'path' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
              ],
            },
          },
        ],
      },
    },
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'OperationErrorSelection' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'OperationError' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [{ kind: 'Field', name: { kind: 'Name', value: 'message' } }],
      },
    },
  ],
} as unknown as DocumentNode<
  containers_Bucket_PackageDialog_gql_PackagePromoteMutation,
  containers_Bucket_PackageDialog_gql_PackagePromoteMutationVariables
>

export { containers_Bucket_PackageDialog_gql_PackagePromoteDocument as default }
