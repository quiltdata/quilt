/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../../model/graphql/types.generated'

export type containers_Bucket_PackageCompare_RevisionsRange_gql_RevisionsListQueryVariables =
  Types.Exact<{
    bucket: Types.Scalars['String']
    name: Types.Scalars['String']
  }>

export type containers_Bucket_PackageCompare_RevisionsRange_gql_RevisionsListQuery = {
  readonly __typename: 'Query'
} & {
  readonly package: Types.Maybe<
    { readonly __typename: 'Package' } & Pick<Types.Package, 'bucket' | 'name'> & {
        readonly revisions: { readonly __typename: 'PackageRevisionList' } & {
          readonly page: ReadonlyArray<
            { readonly __typename: 'PackageRevision' } & Pick<
              Types.PackageRevision,
              'hash' | 'message' | 'modified'
            >
          >
        }
      }
  >
}

export const containers_Bucket_PackageCompare_RevisionsRange_gql_RevisionsListDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {
        kind: 'Name',
        value: 'containers_Bucket_PackageCompare_RevisionsRange_gql_RevisionsList',
      },
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
                  name: { kind: 'Name', value: 'revisions' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
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
                            { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'modified' } },
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
  containers_Bucket_PackageCompare_RevisionsRange_gql_RevisionsListQuery,
  containers_Bucket_PackageCompare_RevisionsRange_gql_RevisionsListQueryVariables
>

export { containers_Bucket_PackageCompare_RevisionsRange_gql_RevisionsListDocument as default }
