/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../model/graphql/types.generated'

export type BucketVersioningState =
  | 'ACCESS_DENIED'
  | 'ENABLED'
  | 'NOT_FOUND'
  | 'SUSPENDED'
  | 'UNVERSIONED'

export type components_BucketVersioning_gql_BucketVersioningStatusQueryVariables = Exact<{
  name: string
}>

export interface components_BucketVersioning_gql_BucketVersioningStatusQuery {
  readonly __typename: 'Query'
  readonly bucketVersioningStatus: Types.BucketVersioningState
}

export const components_BucketVersioning_gql_BucketVersioningStatusDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: {
        kind: 'Name',
        value: 'components_BucketVersioning_gql_BucketVersioningStatus',
      },
      variableDefinitions: [
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
            name: { kind: 'Name', value: 'bucketVersioningStatus' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'name' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'name' } },
              },
            ],
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  components_BucketVersioning_gql_BucketVersioningStatusQuery,
  components_BucketVersioning_gql_BucketVersioningStatusQueryVariables
>

export { components_BucketVersioning_gql_BucketVersioningStatusDocument as default }
