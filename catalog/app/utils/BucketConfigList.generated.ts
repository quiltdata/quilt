/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../model/graphql/types.generated'

export type utils_BucketConfigListQueryVariables = Types.Exact<{
  includeCollaborators?: Types.Scalars['Boolean']
}>

export type utils_BucketConfigListQuery = { readonly __typename: 'Query' } & {
  readonly bucketConfigs: ReadonlyArray<
    { readonly __typename: 'BucketConfig' } & Pick<
      Types.BucketConfig,
      | 'name'
      | 'title'
      | 'iconUrl'
      | 'description'
      | 'linkedData'
      | 'overviewUrl'
      | 'tags'
      | 'relevanceScore'
    > & {
        readonly collaborators?: Types.Maybe<
          ReadonlyArray<
            { readonly __typename: 'CollaboratorBucketConnection' } & Pick<
              Types.CollaboratorBucketConnection,
              'permissionLevel'
            > & {
                readonly collaborator: { readonly __typename: 'Collaborator' } & Pick<
                  Types.Collaborator,
                  'email' | 'username'
                >
              }
          >
        >
      }
  >
}

export const utils_BucketConfigListDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'utils_BucketConfigList' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: {
            kind: 'Variable',
            name: { kind: 'Name', value: 'includeCollaborators' },
          },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'Boolean' } },
          },
          defaultValue: { kind: 'BooleanValue', value: false },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'bucketConfigs' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                { kind: 'Field', name: { kind: 'Name', value: 'iconUrl' } },
                { kind: 'Field', name: { kind: 'Name', value: 'description' } },
                { kind: 'Field', name: { kind: 'Name', value: 'linkedData' } },
                { kind: 'Field', name: { kind: 'Name', value: 'overviewUrl' } },
                { kind: 'Field', name: { kind: 'Name', value: 'tags' } },
                { kind: 'Field', name: { kind: 'Name', value: 'relevanceScore' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'collaborators' },
                  directives: [
                    {
                      kind: 'Directive',
                      name: { kind: 'Name', value: 'include' },
                      arguments: [
                        {
                          kind: 'Argument',
                          name: { kind: 'Name', value: 'if' },
                          value: {
                            kind: 'Variable',
                            name: { kind: 'Name', value: 'includeCollaborators' },
                          },
                        },
                      ],
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'collaborator' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'email' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'username' } },
                          ],
                        },
                      },
                      { kind: 'Field', name: { kind: 'Name', value: 'permissionLevel' } },
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
  utils_BucketConfigListQuery,
  utils_BucketConfigListQueryVariables
>

export { utils_BucketConfigListDocument as default }
