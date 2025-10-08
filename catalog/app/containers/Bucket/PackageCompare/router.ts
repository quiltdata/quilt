import invariant from 'invariant'
import * as React from 'react'
import * as RRDom from 'react-router-dom'

import * as NamedRoutes from 'utils/NamedRoutes'
import type { PackageHandle } from 'utils/packageHandle'
import parseSearch from 'utils/parseSearch'

interface PackageCompareParams {
  bucket: string
  name: string
  baseHash: string
  otherHash: string
}

type Single = [PackageHandle]
type Pair = [PackageHandle, PackageHandle]

export const isPair = (x: Single | Pair): x is Pair => x.length > 1

export function useRouter() {
  const { bucket, name, baseHash, otherHash } = RRDom.useParams<PackageCompareParams>()

  invariant(!!bucket, '`bucket` must be defined')
  invariant(!!name, '`name` must be defined')
  invariant(!!baseHash, '`baseHash` must be defined')

  const { push } = RRDom.useHistory()
  const { urls } = NamedRoutes.use()
  const location = RRDom.useLocation()
  const { showAll } = parseSearch(location.search)

  const pair: Single | Pair = React.useMemo(() => {
    const base = { bucket, name, hash: baseHash }
    if (!otherHash) return [base]
    return [base, { bucket, name, hash: otherHash }]
  }, [bucket, name, baseHash, otherHash])

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
        ? urls.bucketPackageCompare(bucket, name, baseHash, otherHash)
        : urls.bucketPackageCompare(bucket, name, baseHash, otherHash, {
            showAll: true,
          })
      push(route)
    },
    [bucket, name, baseHash, otherHash, push, urls],
  )

  return {
    bucket,
    name,

    pair,

    changeBase,
    changeOther,
    swap,

    changesOnly,
    toggleChangesOnly,
  }
}
