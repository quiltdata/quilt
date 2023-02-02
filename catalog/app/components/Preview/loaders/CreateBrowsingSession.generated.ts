/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../model/graphql/types.generated'

export type components_Preview_loaders_CreateBrowsingSessionMutationVariables =
  Types.Exact<{
    scope: Types.Scalars['String']
    ttl: Types.Maybe<Types.Scalars['Int']>
  }>

export type components_Preview_loaders_CreateBrowsingSessionMutation = {
  readonly __typename: 'Mutation'
} & {
  readonly browsingSessionCreate:
    | ({ readonly __typename: 'BrowsingSession' } & Pick<Types.BrowsingSession, 'id'>)
    | { readonly __typename: 'InvalidInput' }
    | { readonly __typename: 'OperationError' }
}

export const components_Preview_loaders_CreateBrowsingSessionDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: { kind: 'Name', value: 'components_Preview_loaders_CreateBrowsingSession' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'scope' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'ttl' } },
          type: { kind: 'NamedType', name: { kind: 'Name', value: 'Int' } },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'browsingSessionCreate' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'scope' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'scope' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'ttl' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'ttl' } },
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
                    name: { kind: 'Name', value: 'BrowsingSession' },
                  },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [{ kind: 'Field', name: { kind: 'Name', value: 'id' } }],
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
  components_Preview_loaders_CreateBrowsingSessionMutation,
  components_Preview_loaders_CreateBrowsingSessionMutationVariables
>

export { components_Preview_loaders_CreateBrowsingSessionDocument as default }
