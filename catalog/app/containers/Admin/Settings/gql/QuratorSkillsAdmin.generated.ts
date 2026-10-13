/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never }
import * as Types from '../../../../model/graphql/types.generated'

import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
export type QuratorSkillRunClass =
  /** Qurator can follow it with its own tools. */
  | 'GUIDE'
  /** It expects a shell, scripts or local compute; Qurator explains the steps instead. */
  | 'SHELL'

export type containers_Admin_Settings_gql_QuratorSkillsAdminQueryVariables = Exact<{
  [key: string]: never
}>

export interface containers_Admin_Settings_gql_QuratorSkillsAdminQuery {
  readonly __typename: 'Query'
  readonly config: {
    readonly __typename: 'Config'
    readonly quratorSkills: {
      readonly __typename: 'QuratorSkills'
      readonly topHash: string | null
      readonly skills: ReadonlyArray<{
        readonly __typename: 'QuratorSkill'
        readonly name: string
        readonly description: string
        readonly license: string | null
        readonly runClass: Types.QuratorSkillRunClass
        readonly source: string | null
        readonly files: ReadonlyArray<string>
      }>
    } | null
  }
}

export const containers_Admin_Settings_gql_QuratorSkillsAdminDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'query',
      name: { kind: 'Name', value: 'containers_Admin_Settings_gql_QuratorSkillsAdmin' },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'config' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'quratorSkills' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'topHash' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'skills' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                            {
                              kind: 'Field',
                              name: { kind: 'Name', value: 'description' },
                            },
                            { kind: 'Field', name: { kind: 'Name', value: 'license' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'runClass' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'source' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'files' } },
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
      },
    },
  ],
} as unknown as DocumentNode<
  containers_Admin_Settings_gql_QuratorSkillsAdminQuery,
  containers_Admin_Settings_gql_QuratorSkillsAdminQueryVariables
>

export { containers_Admin_Settings_gql_QuratorSkillsAdminDocument as default }
