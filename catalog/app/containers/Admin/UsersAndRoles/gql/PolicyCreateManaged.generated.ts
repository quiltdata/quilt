/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

import {
  PolicyResultSelection_Policy_Fragment,
  PolicyResultSelection_InvalidInput_Fragment,
  PolicyResultSelection_OperationError_Fragment,
  PolicyResultSelectionFragmentDoc,
} from './PolicyResultSelection.generated'

export type containers_Admin_RolesAndPolicies_gql_PolicyCreateManagedMutationVariables =
  Types.Exact<{
    input: Types.ManagedPolicyInput
  }>

export type containers_Admin_RolesAndPolicies_gql_PolicyCreateManagedMutation = {
  readonly __typename: 'Mutation'
} & {
  readonly policyCreate:
    | ({ readonly __typename: 'Policy' } & PolicyResultSelection_Policy_Fragment)
    | ({
        readonly __typename: 'InvalidInput'
      } & PolicyResultSelection_InvalidInput_Fragment)
    | ({
        readonly __typename: 'OperationError'
      } & PolicyResultSelection_OperationError_Fragment)
}

export const containers_Admin_RolesAndPolicies_gql_PolicyCreateManagedDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {
        kind: 'Name',
        value: 'containers_Admin_RolesAndPolicies_gql_PolicyCreateManaged',
      },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'input' } },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'ManagedPolicyInput' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            alias: { kind: 'Name', value: 'policyCreate' },
            name: { kind: 'Name', value: 'policyCreateManaged' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'input' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'input' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'PolicyResultSelection' },
                },
              ],
            },
          },
        ],
      },
    },
    ...PolicyResultSelectionFragmentDoc.definitions,
  ],
} as unknown as DocumentNode<
  containers_Admin_RolesAndPolicies_gql_PolicyCreateManagedMutation,
  containers_Admin_RolesAndPolicies_gql_PolicyCreateManagedMutationVariables
>

export { containers_Admin_RolesAndPolicies_gql_PolicyCreateManagedDocument as default }
