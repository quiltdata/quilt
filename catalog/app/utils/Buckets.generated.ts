/* eslint-disable @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../model/graphql/types.generated'

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type BucketPermissionLevel = 'READ' | 'READ_WRITE'

export type utils_BucketsQueryVariables = Exact<{
  includeCollaborators?: boolean
}>

export interface utils_BucketsQuery {
  readonly __typename: 'Query'
  readonly buckets: ReadonlyArray<{
    readonly __typename: 'Bucket'
    readonly name: string
    readonly title: string
    readonly iconUrl: string | null
    readonly description: string | null
    readonly tags: ReadonlyArray<string> | null
    readonly relevanceScore: number
    readonly collaborators?: ReadonlyArray<{
      readonly __typename: 'CollaboratorBucketConnection'
      readonly permissionLevel: Types.BucketPermissionLevel
      readonly collaborator: {
        readonly __typename: 'Collaborator'
        readonly email: string
        readonly username: string
      }
    }>
  }>
}

export const utils_BucketsDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'utils_Buckets' },
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
            name: { kind: 'Name', value: 'buckets' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'title' } },
                { kind: 'Field', name: { kind: 'Name', value: 'iconUrl' } },
                { kind: 'Field', name: { kind: 'Name', value: 'description' } },
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
} as unknown as DocumentNode<utils_BucketsQuery, utils_BucketsQueryVariables>

export { utils_BucketsDocument as default }
