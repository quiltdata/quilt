/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type InvalidInputSelectionFragment = { readonly __typename: 'InvalidInput' } & {
  readonly errors: ReadonlyArray<
    { readonly __typename: 'InputError' } & Pick<Types.InputError, 'path' | 'message'>
  >
}

export const InvalidInputSelectionFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'InvalidInputSelection' },
      typeCondition: { kind: 'NamedType', name: { kind: 'Name', value: 'InvalidInput' } },
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
  ],
} as unknown as DocumentNode<InvalidInputSelectionFragment, unknown>
