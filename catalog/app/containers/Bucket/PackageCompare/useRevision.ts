import * as React from 'react'

import * as Model from 'model'
import * as GQL from 'utils/GraphQL'

import REVISION_QUERY from './gql/Revision.generated'

export type Revision = Pick<
  Model.GQLTypes.PackageRevision,
  'hash' | 'modified' | 'message' | 'userMeta' | 'totalBytes' | 'contentsFlatMap'
>

export type RevisionResult =
  | { _tag: 'loading' }
  | { _tag: 'error'; error: Error }
  | { _tag: 'ok'; revision: Revision }

export function useRevision(
  bucket: string,
  name: string,
  hashOrTag: string,
): RevisionResult {
  const query = GQL.useQuery(REVISION_QUERY, { bucket, name, hashOrTag })

  return React.useMemo(
    () =>
      GQL.fold(query, {
        fetching: () => ({ _tag: 'loading' }),
        error: (error) => ({ _tag: 'error', error }),
        data: (data) =>
          data.package?.revision
            ? { _tag: 'ok', revision: data.package?.revision }
            : { _tag: 'error', error: new Error('No revision data found') },
      }),
    [query],
  )
}
