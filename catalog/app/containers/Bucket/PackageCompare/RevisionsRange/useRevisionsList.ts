import * as React from 'react'

import * as GQL from 'utils/GraphQL'

import REVISIONS_LIST_QUERY from './gql/RevisionsList.generated'

type QueryData = GQL.DataForDoc<typeof REVISIONS_LIST_QUERY>
type PackageData = NonNullable<QueryData['package']>
export type RevisionsListItem = Omit<
  NonNullable<PackageData['revisions']['page'][number]>,
  '__typename'
>

type Result =
  | { _tag: 'loading' }
  | { _tag: 'error'; error: Error }
  | { _tag: 'ok'; revisions: ReadonlyArray<RevisionsListItem> }

export default function useRevisionsList(bucket: string, name: string): Result {
  const query = GQL.useQuery(REVISIONS_LIST_QUERY, { bucket, name })
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
