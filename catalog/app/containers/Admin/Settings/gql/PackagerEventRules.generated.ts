/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type containers_Admin_Settings_gql_PackagerEventRulesQueryVariables = Types.Exact<{
  [key: string]: never
}>

export type containers_Admin_Settings_gql_PackagerEventRulesQuery = {
  readonly __typename: 'Query'
} & {
  readonly admin: { readonly __typename: 'AdminQueries' } & {
    readonly packager: { readonly __typename: 'PackagerAdminQueries' } & {
      readonly eventRules: ReadonlyArray<
        { readonly __typename: 'PackagerEventRule' } & Pick<
          Types.PackagerEventRule,
          'name' | 'enabled'
        >
      >
    }
  }
}

export const containers_Admin_Settings_gql_PackagerEventRulesDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Admin_Settings_gql_PackagerEventRules' },
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
                  name: { kind: 'Name', value: 'packager' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'eventRules' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'enabled' } },
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
  containers_Admin_Settings_gql_PackagerEventRulesQuery,
  containers_Admin_Settings_gql_PackagerEventRulesQueryVariables
>

export { containers_Admin_Settings_gql_PackagerEventRulesDocument as default }
