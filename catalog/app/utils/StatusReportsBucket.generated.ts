/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../model/graphql/types.generated'

export type utils_StatusReportsBucketQueryVariables = Types.Exact<{
  [key: string]: never
}>

export type utils_StatusReportsBucketQuery = { readonly __typename: 'Query' } & {
  readonly status:
    | ({ readonly __typename: 'Status' } & Pick<Types.Status, 'reportsBucket'>)
    | { readonly __typename: 'Unavailable' }
}

export const utils_StatusReportsBucketDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'utils_StatusReportsBucket' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'status' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
                {
                  kind: 'InlineFragment',
                  typeCondition: {
                    kind: 'NamedType',
                    name: { kind: 'Name', value: 'Status' },
                  },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'reportsBucket' } },
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
  utils_StatusReportsBucketQuery,
  utils_StatusReportsBucketQueryVariables
>

export { utils_StatusReportsBucketDocument as default }
