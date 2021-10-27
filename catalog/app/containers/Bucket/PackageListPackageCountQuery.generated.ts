/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../model/graphql/types.generated'

export type containers_Bucket_PackageListPackageCountQueryQueryVariables = Types.Exact<{
  bucket: Types.Scalars['String']
  filter: Types.Maybe<Types.Scalars['String']>
}>

export type containers_Bucket_PackageListPackageCountQueryQuery = {
  readonly __typename: 'Query'
} & {
  readonly packages: Types.Maybe<
    { readonly __typename: 'PackageList' } & Pick<Types.PackageList, 'total'>
  >
}

export const containers_Bucket_PackageListPackageCountQueryDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Bucket_PackageListPackageCountQuery' },
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
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'packages' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'bucket' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'bucket' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'filter' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'filter' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'total' } }],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  containers_Bucket_PackageListPackageCountQueryQuery,
  containers_Bucket_PackageListPackageCountQueryQueryVariables
>

export { containers_Bucket_PackageListPackageCountQueryDocument as default }
