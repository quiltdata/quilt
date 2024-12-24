/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type OperationErrorSelectionFragment = {
  readonly __typename: 'OperationError'
} & Pick<Types.OperationError, 'message'>

export const OperationErrorSelectionFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'OperationErrorSelection' },
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
} as unknown as DocumentNode<OperationErrorSelectionFragment, unknown>
