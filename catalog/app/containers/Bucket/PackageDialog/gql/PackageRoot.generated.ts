/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type containers_Bucket_PackageDialog_gql_PackageRootQueryVariables = Types.Exact<{
  [key: string]: never
}>

export type containers_Bucket_PackageDialog_gql_PackageRootQuery = {
  readonly __typename: 'Query'
} & {
  readonly config: { readonly __typename: 'Config' } & Pick<Types.Config, 'packageRoot'>
}

export const containers_Bucket_PackageDialog_gql_PackageRootDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Bucket_PackageDialog_gql_PackageRoot' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'config' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'packageRoot' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  containers_Bucket_PackageDialog_gql_PackageRootQuery,
  containers_Bucket_PackageDialog_gql_PackageRootQueryVariables
>

export { containers_Bucket_PackageDialog_gql_PackageRootDocument as default }
