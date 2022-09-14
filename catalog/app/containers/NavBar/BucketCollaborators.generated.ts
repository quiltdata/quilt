/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../model/graphql/types.generated'

export type containers_NavBar_BucketCollaboratorsQueryVariables = Types.Exact<{
  bucket: Types.Scalars['String']
}>

export type containers_NavBar_BucketCollaboratorsQuery = {
  readonly __typename: 'Query'
} & {
  readonly bucketConfig: Types.Maybe<
    { readonly __typename: 'BucketConfig' } & Pick<Types.BucketConfig, 'name'> & {
        readonly collaborators: ReadonlyArray<
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
      }
  >
}

export const containers_NavBar_BucketCollaboratorsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_NavBar_BucketCollaborators' },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'bucket' } },
          type: {
            kind: 'NonNullType',
            type: { kind: 'NamedType', name: { kind: 'Name', value: 'String' } },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'bucketConfig' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'name' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'bucket' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'collaborators' },
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
  containers_NavBar_BucketCollaboratorsQuery,
  containers_NavBar_BucketCollaboratorsQueryVariables
>

export { containers_NavBar_BucketCollaboratorsDocument as default }
