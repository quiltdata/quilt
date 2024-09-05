/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

import {
  PolicySelectionFragment,
  PolicySelectionFragmentDoc,
} from './PolicySelection.generated'

export type PolicyResultSelection_Policy_Fragment = {
  readonly __typename: 'Policy'
} & PolicySelectionFragment

export type PolicyResultSelection_InvalidInput_Fragment = {
  readonly __typename: 'InvalidInput'
} & {
  readonly errors: ReadonlyArray<
    { readonly __typename: 'InputError' } & Pick<Types.InputError, 'path' | 'message'>
  >
}

export type PolicyResultSelection_OperationError_Fragment = {
  readonly __typename: 'OperationError'
} & Pick<Types.OperationError, 'message'>

export type PolicyResultSelectionFragment =
  | PolicyResultSelection_Policy_Fragment
  | PolicyResultSelection_InvalidInput_Fragment
  | PolicyResultSelection_OperationError_Fragment

export const PolicyResultSelectionFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PolicyResultSelection' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'PolicyResult' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
          {
            kind: 'InlineFragment',
            typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'Policy' } },
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
          {
            kind: 'InlineFragment',
            typeCondition: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'InvalidInput' },
            },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'errors' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'path' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                    ],
                  },
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
              selections: [{ kind: 'Field', name: { kind: 'Name', value: 'message' } }],
            },
          },
        ],
      },
    },
    ...PolicySelectionFragmentDoc.definitions,
  ],
} as unknown as DocumentNode<PolicyResultSelectionFragment, unknown>
