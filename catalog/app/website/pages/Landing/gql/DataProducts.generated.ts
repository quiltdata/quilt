/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type website_pages_Landing_gql_DataProductsQueryVariables = Exact<{
  [key: string]: never
}>

export interface website_pages_Landing_gql_DataProductsQuery {
  readonly __typename: 'Query'
  readonly dataProducts: ReadonlyArray<{
    readonly __typename: 'DataProduct'
    readonly id: string
    readonly name: string
  }>
}

export const website_pages_Landing_gql_DataProductsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'website_pages_Landing_gql_DataProducts' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'dataProducts' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'id' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  website_pages_Landing_gql_DataProductsQuery,
  website_pages_Landing_gql_DataProductsQueryVariables
>

export { website_pages_Landing_gql_DataProductsDocument as default }
