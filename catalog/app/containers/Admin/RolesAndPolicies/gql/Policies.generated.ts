/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

import {
  PolicySelectionFragment,
  PolicySelectionFragmentDoc,
} from './PolicySelection.generated'

export type containers_Admin_RolesAndPolicies_gql_PoliciesQueryVariables = Types.Exact<{
  [key: string]: never
}>

export type containers_Admin_RolesAndPolicies_gql_PoliciesQuery = {
  readonly __typename: 'Query'
} & {
  readonly policies: ReadonlyArray<
    { readonly __typename: 'Policy' } & PolicySelectionFragment
  >
}

export const containers_Admin_RolesAndPolicies_gql_PoliciesDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Admin_RolesAndPolicies_gql_Policies' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'policies' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'PolicySelection' },
                },
              ],
            },
          },
        ],
      },
    },
    ...PolicySelectionFragmentDoc.definitions,
  ],
} as unknown as DocumentNode<
  containers_Admin_RolesAndPolicies_gql_PoliciesQuery,
  containers_Admin_RolesAndPolicies_gql_PoliciesQueryVariables
>

export { containers_Admin_RolesAndPolicies_gql_PoliciesDocument as default }
