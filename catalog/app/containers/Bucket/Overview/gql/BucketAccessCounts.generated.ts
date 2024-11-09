/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type AccessCountsSelectionFragment = {
  readonly __typename: 'AccessCounts'
} & Pick<Types.AccessCounts, 'total'> & {
    readonly counts: ReadonlyArray<
      { readonly __typename: 'AccessCountForDate' } & Pick<
        Types.AccessCountForDate,
        'date' | 'value'
      >
    >
  }

export type containers_Bucket_Overview_gql_BucketAccessCountsQueryVariables =
  Types.Exact<{
    bucket: Types.Scalars['String']
    window: Types.Scalars['Int']
  }>

export type containers_Bucket_Overview_gql_BucketAccessCountsQuery = {
  readonly __typename: 'Query'
} & {
  readonly bucketAccessCounts: Types.Maybe<
    { readonly __typename: 'BucketAccessCounts' } & {
      readonly byExt: Types.Maybe<
        ReadonlyArray<
          { readonly __typename: 'AccessCountsGroup' } & Pick<
            Types.AccessCountsGroup,
            'ext'
          > & {
              readonly counts: {
                readonly __typename: 'AccessCounts'
              } & AccessCountsSelectionFragment
            }
        >
      >
      readonly byExtCollapsed: Types.Maybe<
        ReadonlyArray<
          { readonly __typename: 'AccessCountsGroup' } & Pick<
            Types.AccessCountsGroup,
            'ext'
          > & {
              readonly counts: {
                readonly __typename: 'AccessCounts'
              } & AccessCountsSelectionFragment
            }
        >
      >
      readonly combined: Types.Maybe<
        { readonly __typename: 'AccessCounts' } & AccessCountsSelectionFragment
      >
    }
  >
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
    ...AccessCountsSelectionFragmentDoc.definitions,
  ],
} as unknown as DocumentNode<
  containers_Bucket_Overview_gql_BucketAccessCountsQuery,
  containers_Bucket_Overview_gql_BucketAccessCountsQueryVariables
>

export { containers_Bucket_Overview_gql_BucketAccessCountsDocument as default }
