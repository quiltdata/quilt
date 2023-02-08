/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type components_Preview_loaders_IFrame_DisposeBrowsingSessionMutationVariables =
  Types.Exact<{
    id: Types.Scalars['ID']
  }>

export type components_Preview_loaders_IFrame_DisposeBrowsingSessionMutation = {
  readonly __typename: 'Mutation'
} & {
  readonly browsingSessionDispose:
    | { readonly __typename: 'Ok' }
    | ({ readonly __typename: 'OperationError' } & Pick<Types.OperationError, 'message'>)
}

export const components_Preview_loaders_IFrame_DisposeBrowsingSessionDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {
        kind: 'Name',
        value: 'components_Preview_loaders_IFrame_DisposeBrowsingSession',
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
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'browsingSessionDispose' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'id' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'id' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
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
} as unknown as DocumentNode<
  components_Preview_loaders_IFrame_DisposeBrowsingSessionMutation,
  components_Preview_loaders_IFrame_DisposeBrowsingSessionMutationVariables
>

export { components_Preview_loaders_IFrame_DisposeBrowsingSessionDocument as default }
