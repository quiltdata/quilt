import * as React from 'react'

import * as Model from 'model'
import * as GQL from 'utils/GraphQL'
import type { PackageHandle } from 'utils/packageHandle'

import REVISION_QUERY from './gql/Revision.generated'

export type Revision = Pick<
  Model.GQLTypes.PackageRevision,
  'hash' | 'modified' | 'message' | 'userMeta' | 'totalBytes' | 'contentsFlatMap'
>

type RevisionResult =
  | { _tag: 'loading' }
  | { _tag: 'error'; error: Error }
  | { _tag: 'ok'; revision: Revision }

function useRevision(bucket: string, name: string, hashOrTag: string): RevisionResult {
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

export type RevisionsResult =
  | { _tag: 'loading' }
  | { _tag: 'error'; error: Error }
  | { _tag: 'ok'; revisions: [Revision, Revision] }

function handleResults([base, other]: [RevisionResult, RevisionResult]): RevisionsResult {
  if (base._tag === 'loading' || other._tag === 'loading') {
    return { _tag: 'loading' }
  }

  if (base._tag === 'error') {
    return { _tag: 'error', error: base.error }
  }
  if (other._tag === 'error') {
    return { _tag: 'error', error: other.error }
  }

  return {
    _tag: 'ok',
    revisions: [base.revision, other.revision],
  }
}

export default function useRevisions([base, other]: [PackageHandle, PackageHandle]) {
  const baseResult = useRevision(base.bucket, base.name, base.hash)
  const otherResult = useRevision(other.bucket, other.name, other.hash)

  return React.useMemo(
    () => handleResults([baseResult, otherResult]),
    [baseResult, otherResult],
  )
}
