/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../../model/graphql/types.generated'

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type containers_Admin_Status_gql_MilestonesQueryVariables = Exact<{
  [key: string]: never
}>

export interface containers_Admin_Status_gql_MilestonesQuery {
  readonly __typename: 'Query'
  readonly admin: {
    readonly __typename: 'AdminQueries'
    readonly milestones:
      | { readonly __typename: 'OperationError'; readonly message: string }
      | {
          readonly __typename: 'StackMilestones'
          readonly packages: number
          readonly largestPackageBytes: number | null
          readonly firstPackageAt: Date | null
          readonly firstMultiTerabyteAt: Date | null
        }
  }
}

export const containers_Admin_Status_gql_MilestonesDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Admin_Status_gql_Milestones' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'admin' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'milestones' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
                      {
                        kind: 'InlineFragment',
                        typeCondition: {
                          kind: 'NamedType',
                          name: { kind: 'Name', value: 'StackMilestones' },
                        },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'packages' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'largestPackageBytes' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'firstPackageAt' },
                            },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'firstMultiTerabyteAt' },
                            },
                          ],
                        },
                      },
                      {
                        kind: 'InlineFragment',
                        typeCondition: {
                          kind: 'NamedType',
                          name: { kind: 'Name', value: 'OperationError' },
                        },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'message' } },
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
  containers_Admin_Status_gql_MilestonesQuery,
  containers_Admin_Status_gql_MilestonesQueryVariables
>

export { containers_Admin_Status_gql_MilestonesDocument as default }
