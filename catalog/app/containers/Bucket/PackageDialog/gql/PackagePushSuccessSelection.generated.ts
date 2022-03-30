/* eslint-disable @typescript-eslint/naming-convention */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core'
import * as Types from '../../../../model/graphql/types.generated'

export type PackagePushSuccessSelectionFragment = {
  readonly __typename: 'PackagePushSuccess'
} & {
  readonly package: { readonly __typename: 'Package' } & Pick<
    Types.Package,
    'bucket' | 'name' | 'modified'
  > & {
      readonly revision: Types.Maybe<
        { readonly __typename: 'PackageRevision' } & Pick<Types.PackageRevision, 'hash'>
      >
      readonly revisions: { readonly __typename: 'PackageRevisionList' } & Pick<
        Types.PackageRevisionList,
        'total'
      > & {
          readonly page: ReadonlyArray<
            { readonly __typename: 'PackageRevision' } & Pick<
              Types.PackageRevision,
              'hash'
            >
          >
          readonly page1: ReadonlyArray<
            { readonly __typename: 'PackageRevision' } & Pick<
              Types.PackageRevision,
              'hash'
            >
          >
        }
    }
  readonly revision: { readonly __typename: 'PackageRevision' } & Pick<
    Types.PackageRevision,
    | 'hash'
    | 'modified'
    | 'message'
    | 'metadata'
    | 'userMeta'
    | 'totalEntries'
    | 'totalBytes'
  > & {
      readonly accessCounts: Types.Maybe<
        { readonly __typename: 'AccessCounts' } & Pick<Types.AccessCounts, 'total'> & {
            readonly counts: ReadonlyArray<
              { readonly __typename: 'AccessCountForDate' } & Pick<
                Types.AccessCountForDate,
                'date' | 'value'
              >
            >
          }
      >
    }
}

export const PackagePushSuccessSelectionFragmentDoc = {
  kind: 'Document',
  definitions: [
    {
      kind: 'FragmentDefinition',
      name: { kind: 'Name', value: 'PackagePushSuccessSelection' },
      typeCondition: {
        kind: 'NamedType',
        name: { kind: 'Name', value: 'PackagePushSuccess' },
      },
      selectionSet: {
        kind: 'SelectionSet',
        selections: [
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'package' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'bucket' } },
                { kind: 'Field', name: { kind: 'Name', value: 'name' } },
                { kind: 'Field', name: { kind: 'Name', value: 'modified' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'revision' },
                  arguments: [
                    {
                      kind: 'Argument',
                      name: { kind: 'Name', value: 'hashOrTag' },
                      value: { kind: 'StringValue', value: 'latest', block: false },
                    },
                  ],
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'hash' } },
                    ],
                  },
                },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'revisions' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'total' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'page' },
                        arguments: [
                          {
                            kind: 'Argument',
                            name: { kind: 'Name', value: 'number' },
                            value: { kind: 'IntValue', value: '1' },
                          },
                          {
                            kind: 'Argument',
                            name: { kind: 'Name', value: 'perPage' },
                            value: { kind: 'IntValue', value: '5' },
                          },
                        ],
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'hash' } },
                          ],
                        },
                      },
                      {
                        kind: 'Field',
                        alias: { kind: 'Name', value: 'page1' },
                        name: { kind: 'Name', value: 'page' },
                        arguments: [
                          {
                            kind: 'Argument',
                            name: { kind: 'Name', value: 'number' },
                            value: { kind: 'IntValue', value: '1' },
                          },
                          {
                            kind: 'Argument',
                            name: { kind: 'Name', value: 'perPage' },
                            value: { kind: 'IntValue', value: '30' },
                          },
                        ],
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'hash' } },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          {
            kind: 'Field',
            name: { kind: 'Name', value: 'revision' },
            selectionSet: {
              kind: 'SelectionSet',
              selections: [
                { kind: 'Field', name: { kind: 'Name', value: 'hash' } },
                { kind: 'Field', name: { kind: 'Name', value: 'modified' } },
                { kind: 'Field', name: { kind: 'Name', value: 'message' } },
                { kind: 'Field', name: { kind: 'Name', value: 'metadata' } },
                { kind: 'Field', name: { kind: 'Name', value: 'userMeta' } },
                { kind: 'Field', name: { kind: 'Name', value: 'totalEntries' } },
                { kind: 'Field', name: { kind: 'Name', value: 'totalBytes' } },
                {
                  kind: 'Field',
                  name: { kind: 'Name', value: 'accessCounts' },
                  selectionSet: {
                    kind: 'SelectionSet',
                    selections: [
                      { kind: 'Field', name: { kind: 'Name', value: 'total' } },
                      {
                        kind: 'Field',
                        name: { kind: 'Name', value: 'counts' },
                        selectionSet: {
                          kind: 'SelectionSet',
                          selections: [
                            { kind: 'Field', name: { kind: 'Name', value: 'date' } },
                            { kind: 'Field', name: { kind: 'Name', value: 'value' } },
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
} as unknown as DocumentNode<PackagePushSuccessSelectionFragment, unknown>
