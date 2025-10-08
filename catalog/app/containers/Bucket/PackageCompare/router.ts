import invariant from 'invariant'
import * as React from 'react'
import * as RRDom from 'react-router-dom'

import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'

interface PackageCompareParams {
  bucket: string
  name: string
  baseHash: string
  otherHash: string
}

export default function useRouter() {
  const { bucket, name, baseHash, otherHash } = RRDom.useParams<PackageCompareParams>()

  invariant(!!bucket, '`bucket` must be defined')
  invariant(!!name, '`name` must be defined')
  invariant(!!baseHash, '`baseHash` must be defined')

  const { push } = RRDom.useHistory()
  const { urls } = NamedRoutes.use()
  const location = RRDom.useLocation()
  const { showAll } = parseSearch(location.search)

  const base = React.useMemo(
    () => ({ bucket, name, hash: baseHash }),
    [bucket, name, baseHash],
  )
  const other = React.useMemo(
    () => (otherHash ? { bucket, name, hash: otherHash } : null),
    [bucket, name, otherHash],
  )

  const changeBase = React.useCallback(
    (hash: string) =>
      push(urls.bucketPackageCompare(bucket, name, hash, otherHash, { showAll })),
    [bucket, name, push, otherHash, urls, showAll],
  )
  const changeOther = React.useCallback(
    (hash: string) =>
      push(urls.bucketPackageCompare(bucket, name, baseHash, hash, { showAll })),
    [bucket, name, push, baseHash, urls, showAll],
  )
  const swap = React.useCallback(
    () => push(urls.bucketPackageCompare(bucket, name, otherHash, baseHash, { showAll })),
    [bucket, name, push, baseHash, otherHash, urls, showAll],
  )

  const changesOnly = !showAll || showAll === 'false'
  const toggleChangesOnly = React.useCallback(
    (checked: boolean) => {
      const route = checked
        ? urls.bucketPackageCompare(bucket, name, base.hash, other?.hash)
        : urls.bucketPackageCompare(bucket, name, base.hash, other?.hash, {
            showAll: true,
          })
      push(route)
    },
    [bucket, name, base, other, push, urls],
  )

  return {
    bucket,
    name,

    base,
    other,

    changeBase,
    changeOther,
    swap,

    changesOnly,
    toggleChangesOnly,
  }
}
