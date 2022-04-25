/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

import {
  PolicyResultSelection_Policy_Fragment,
  PolicyResultSelection_InvalidInput_Fragment,
  PolicyResultSelection_OperationError_Fragment,
  PolicyResultSelectionFragmentDoc,
} from './PolicyResultSelection.generated'

export type containers_Admin_RolesAndPolicies_gql_PolicyUpdateManagedMutationVariables =
  Types.Exact<{
    id: Types.Scalars['ID']
    input: Types.ManagedPolicyInput
  }>

export type containers_Admin_RolesAndPolicies_gql_PolicyUpdateManagedMutation = {
  readonly __typename: 'Mutation'
} & {
  readonly policyUpdate:
    | ({ readonly __typename: 'Policy' } & PolicyResultSelection_Policy_Fragment)
    | ({
        readonly __typename: 'InvalidInput'
      } & PolicyResultSelection_InvalidInput_Fragment)
    | ({
        readonly __typename: 'OperationError'
      } & PolicyResultSelection_OperationError_Fragment)
}

export const containers_Admin_RolesAndPolicies_gql_PolicyUpdateManagedDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {
        kind: 'Name',
        value: 'containers_Admin_RolesAndPolicies_gql_PolicyUpdateManaged',
      },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'ID' } },
          },
        },
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
            alias: { kind: 'Name', value: 'policyUpdate' },
            name: { kind: 'Name', value: 'policyUpdateManaged' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
              },
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
  containers_Admin_RolesAndPolicies_gql_PolicyUpdateManagedMutation,
  containers_Admin_RolesAndPolicies_gql_PolicyUpdateManagedMutationVariables
>

export { containers_Admin_RolesAndPolicies_gql_PolicyUpdateManagedDocument as default }
