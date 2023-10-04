/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

import {
  PackagePushSuccessSelectionFragment,
  PackagePushSuccessSelectionFragmentDoc,
} from './PackagePushSuccessSelection.generated'
import {
  InvalidInputSelectionFragment,
  InvalidInputSelectionFragmentDoc,
} from './InvalidInputSelection.generated'
import {
  OperationErrorSelectionFragment,
  OperationErrorSelectionFragmentDoc,
} from './OperationErrorSelection.generated'

export type containers_Bucket_PackageDialog_gql_PackageFromFolderMutationVariables =
  Types.Exact<{
    params: Types.PackagePushParams
    src: Types.PackageFromFolderSource
  }>

export type containers_Bucket_PackageDialog_gql_PackageFromFolderMutation = {
  readonly __typename: 'Mutation'
} & {
  readonly packageFromFolder:
    | ({
        readonly __typename: 'PackagePushSuccess'
      } & PackagePushSuccessSelectionFragment)
    | ({ readonly __typename: 'InvalidInput' } & InvalidInputSelectionFragment)
    | ({ readonly __typename: 'OperationError' } & OperationErrorSelectionFragment)
}

export const containers_Bucket_PackageDialog_gql_PackageFromFolderDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {
        kind: 'Name',
        value: 'containers_Bucket_PackageDialog_gql_PackageFromFolder',
      },
      variableDefinitions: [
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'params' } },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'PackagePushParams' },
            },
          },
        },
        {
          kind: 'VariableDefinition',
          variable: { kind: 'Variable', name: { kind: 'Name', value: 'src' } },
          type: {
            kind: 'NonNullType',
            type: {
              kind: 'NamedType',
              name: { kind: 'Name', value: 'PackageFromFolderSource' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'packageFromFolder' },
            arguments: [
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'params' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'params' } },
              },
              {
                kind: 'Argument',
                name: { kind: 'Name', value: 'src' },
                value: { kind: 'Variable', name: { kind: 'Name', value: 'src' } },
              },
            ],
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: '__typename' } },
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'PackagePushSuccessSelection' },
                },
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'InvalidInputSelection' },
                },
                {
                  kind: 'FragmentSpread',
                  name: { kind: 'Name', value: 'OperationErrorSelection' },
                },
              ],
            },
          },
        ],
      },
    },
    ...PackagePushSuccessSelectionFragmentDoc.definitions,
    ...InvalidInputSelectionFragmentDoc.definitions,
    ...OperationErrorSelectionFragmentDoc.definitions,
  ],
} as unknown as DocumentNode<
  containers_Bucket_PackageDialog_gql_PackageFromFolderMutation,
  containers_Bucket_PackageDialog_gql_PackageFromFolderMutationVariables
>

export { containers_Bucket_PackageDialog_gql_PackageFromFolderDocument as default }
