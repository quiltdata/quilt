/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type AccessCountsSelectionFragment = {
  readonly __typename: 'AccessCounts'
  readonly total: number
  readonly counts: ReadonlyArray<{
    readonly __typename: 'AccessCountForDate'
    readonly date: Date
    readonly value: number
  }>
}

export type containers_Bucket_Overview_gql_BucketAccessCountsQueryVariables = Exact<{
  bucket: string
  window: number
}>

export interface containers_Bucket_Overview_gql_BucketAccessCountsQuery {
  readonly __typename: 'Query'
  readonly bucketAccessCounts: {
    readonly __typename: 'BucketAccessCounts'
    readonly byExt: ReadonlyArray<{
      readonly __typename: 'AccessCountsGroup'
      readonly ext: string
      readonly counts: {
        readonly __typename: 'AccessCounts'
        readonly total: number
        readonly counts: ReadonlyArray<{
          readonly __typename: 'AccessCountForDate'
          readonly date: Date
          readonly value: number
        }>
      }
    }>
    readonly byExtCollapsed: ReadonlyArray<{
      readonly __typename: 'AccessCountsGroup'
      readonly ext: string
      readonly counts: {
        readonly __typename: 'AccessCounts'
        readonly total: number
        readonly counts: ReadonlyArray<{
          readonly __typename: 'AccessCountForDate'
          readonly date: Date
          readonly value: number
        }>
      }
    }>
    readonly combined: {
      readonly __typename: 'AccessCounts'
      readonly total: number
      readonly counts: ReadonlyArray<{
        readonly __typename: 'AccessCountForDate'
        readonly date: Date
        readonly value: number
      }>
    }
  } | null
}

export const AccessCountsSelectionFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'AccessCountsSelection' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'AccessCounts' } },
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
} as unknown as DocumentNode<AccessCountsSelectionFragment, unknown>
export const containers_Bucket_Overview_gql_BucketAccessCountsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Bucket_Overview_gql_BucketAccessCounts' },
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
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'window' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'bucketAccessCounts' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'bucket' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'bucket' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'window' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'window' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'byExt' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'ext' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'counts' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: { kind: 'Name', value: 'AccessCountsSelection' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  alias: { kind: 'Name', value: 'byExtCollapsed' },
                  name: { kind: 'Name', value: 'byExt' },
                  arguments: [
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'groups' },
                      value: { kind: 'IntValue', value: '10' },
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'ext' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'counts' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            {
                              kind: 'FragmentSpread',
                              name: { kind: 'Name', value: 'AccessCountsSelection' },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'combined' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'FragmentSpread',
                        name: { kind: 'Name', value: 'AccessCountsSelection' },
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
      name: { kind: 'Name', value: 'AccessCountsSelection' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'AccessCounts' } },
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
} as unknown as DocumentNode<
  containers_Bucket_Overview_gql_BucketAccessCountsQuery,
  containers_Bucket_Overview_gql_BucketAccessCountsQueryVariables
>

export { containers_Bucket_Overview_gql_BucketAccessCountsDocument as default }
