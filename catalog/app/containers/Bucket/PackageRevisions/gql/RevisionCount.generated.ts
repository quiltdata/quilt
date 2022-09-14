/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type containers_Bucket_PackageRevisions_gql_RevisionCountQueryVariables =
  Types.Exact<{
    bucket: Types.Scalars['String']
    name: Types.Scalars['String']
  }>

export type containers_Bucket_PackageRevisions_gql_RevisionCountQuery = {
  readonly __typename: 'Query'
} & {
  readonly package: Types.Maybe<
    { readonly __typename: 'Package' } & Pick<Types.Package, 'bucket' | 'name'> & {
        readonly revisions: { readonly __typename: 'PackageRevisionList' } & Pick<
          Types.PackageRevisionList,
          'total'
        >
      }
  >
}

export const containers_Bucket_PackageRevisions_gql_RevisionCountDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {
        kind: 'Name',
        value: 'containers_Bucket_PackageRevisions_gql_RevisionCount',
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
                      { kind: 'Field', name: { kind: 'Name', value: 'total' } },
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
  containers_Bucket_PackageRevisions_gql_RevisionCountQuery,
  containers_Bucket_PackageRevisions_gql_RevisionCountQueryVariables
>

export { containers_Bucket_PackageRevisions_gql_RevisionCountDocument as default }
