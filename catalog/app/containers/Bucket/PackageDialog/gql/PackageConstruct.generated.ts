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

export type containers_Bucket_PackageDialog_gql_PackageConstructMutationVariables =
  Types.Exact<{
    params: Types.PackagePushParams
    src: Types.PackageConstructSource
  }>

export type containers_Bucket_PackageDialog_gql_PackageConstructMutation = {
  readonly __typename: 'Mutation'
} & {
  readonly packageConstruct:
    | ({
        readonly __typename: 'PackagePushSuccess'
      } & PackagePushSuccessSelectionFragment)
    | ({ readonly __typename: 'InvalidInput' } & InvalidInputSelectionFragment)
    | ({ readonly __typename: 'OperationError' } & OperationErrorSelectionFragment)
}

export const containers_Bucket_PackageDialog_gql_PackageConstructDocument = {
  kind: 'Document',
  definitions: [
    {
      kind: 'OperationDefinition',
      operation: 'mutation',
      name: {
        kind: 'Name',
        value: 'containers_Bucket_PackageDialog_gql_PackageConstruct',
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
              name: { kind: 'Name', value: 'PackageConstructSource' },
            },
          },
        },
      ],
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'packageConstruct' },
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
  containers_Bucket_PackageDialog_gql_PackageConstructMutation,
  containers_Bucket_PackageDialog_gql_PackageConstructMutationVariables
>

export { containers_Bucket_PackageDialog_gql_PackageConstructDocument as default }
