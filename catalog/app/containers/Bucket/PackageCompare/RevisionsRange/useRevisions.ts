import * as React from 'react'

import * as Model from 'model'
import * as GQL from 'utils/GraphQL'

import REVISIONS_LIST_QUERY from './gql/RevisionsList.generated'

export type Revision = Pick<
  Model.GQLTypes.PackageRevision,
  'hash' | 'message' | 'modified'
>

export type RevisionsResult =
  | { _tag: 'loading' }
  | { _tag: 'error'; error: Error }
  | { _tag: 'ok'; revisions: ReadonlyArray<Revision> }

export default function useRevisions(bucket: string, name: string): RevisionsResult {
  const query = GQL.useQuery(REVISIONS_LIST_QUERY, {
    bucket,
    name,
    page: 1,
    perPage: 100, // Get enough revisions for the dropdown
  })
  return React.useMemo(
    () =>
      GQL.fold(query, {
        data: (d) => ({ _tag: 'ok', revisions: d.package?.revisions.page || [] }),
        error: (error) => ({ _tag: 'error', error }),
        fetching: () => ({ _tag: 'loading' }),
      }),
    [query],
  )
}
