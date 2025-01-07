import { join } from 'path'

import invariant from 'invariant'
import * as React from 'react'
import * as RRDom from 'react-router-dom'

import type * as Routes from 'constants/routes'
import type * as Model from 'model'
import * as NamedRoutes from 'utils/NamedRoutes'
import type { PackageHandle } from 'utils/packageHandle'
import * as s3paths from 'utils/s3paths'

interface RouteMap {
  bucketFile: Routes.BucketFileArgs
  bucketPackageDetail: Routes.BucketPackageDetailArgs
}

export function editFileInPackage(
  urls: NamedRoutes.Urls<RouteMap>,
  handle: Model.S3.S3ObjectLocation,
  logicalKey: string,
  next: string,
) {
  return urls.bucketFile(handle.bucket, handle.key, {
    add: logicalKey,
    edit: true,
    next,
  })
}

export function useEditFileInPackage(
  packageHandle: PackageHandle,
  fileHandle: Model.S3.S3ObjectLocation,
  logicalKey: string,
) {
  const { urls } = NamedRoutes.use<RouteMap>()
  const { bucket, name } = packageHandle
  const next = urls.bucketPackageDetail(bucket, name, { action: 'revisePackage' })
  return editFileInPackage(urls, fileHandle, logicalKey, next)
}

export function useAddFileInPackage({ bucket, name }: PackageHandle, logicalKey: string) {
  const { urls } = NamedRoutes.use<RouteMap>()
  const next = urls.bucketPackageDetail(bucket, name, { action: 'revisePackage' })
  const fileHandle = React.useMemo(
    () => ({ bucket, key: join(name, logicalKey) }),
    [bucket, logicalKey, name],
  )
  return editFileInPackage(urls, fileHandle, logicalKey, next)
}

export function useParams() {
  const { bucket, path } = RRDom.useParams<{
    bucket: string
    path: string
  }>()
  invariant(bucket, '`bucket` must be defined')

  return { bucket, initialPath: s3paths.getPrefix(path) }
}
