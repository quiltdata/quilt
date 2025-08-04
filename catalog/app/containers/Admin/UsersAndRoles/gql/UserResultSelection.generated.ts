/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

import {
  UserSelectionFragment,
  UserSelectionFragmentDoc,
} from './UserSelection.generated'

export type UserResultSelection_User_Fragment = {
  readonly __typename: 'User'
} & UserSelectionFragment

export type UserResultSelection_InvalidInput_Fragment = {
  readonly __typename: 'InvalidInput'
} & {
  readonly errors: ReadonlyArray<
    { readonly __typename: 'InputError' } & Pick<
      Types.InputError,
      'path' | 'message' | 'name' | 'context'
    >
  >
}

export type UserResultSelection_OperationError_Fragment = {
  readonly __typename: 'OperationError'
} & Pick<Types.OperationError, 'message' | 'name' | 'context'>

export type UserResultSelectionFragment =
  | UserResultSelection_User_Fragment
  | UserResultSelection_InvalidInput_Fragment
  | UserResultSelection_OperationError_Fragment

export const UserResultSelectionFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'UserResultSelection' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'UserResult' } },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
          {
            kind: 'InlineFragment',
            typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'User' } },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'UserSelection' },
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
                      { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                      { kind: 'Field', name: { kind: 'Name', value: 'context' } },
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
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'context' } },
              ],
            },
          },
        ],
      },
    },
    ...UserSelectionFragmentDoc.definitions,
  ],
} as unknown as DocumentNode<UserResultSelectionFragment, unknown>
