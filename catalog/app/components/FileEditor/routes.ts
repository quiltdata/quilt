import invariant from 'invariant'
import * as React from 'react'
import * as RRDom from 'react-router-dom'

import cfg from 'constants/config'
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
): (logicalKey: string) => string {
  const { urls } = NamedRoutes.use<RouteMap>()
  return React.useCallback(
    (logicalKey: string) => {
      const { bucket, name } = packageHandle
      const next = urls.bucketPackageDetail(bucket, name, { action: 'revisePackage' })
      return editFileInPackage(urls, fileHandle, logicalKey, next)
    },
    [fileHandle, packageHandle, urls],
  )
}

export function useAddFileInPackage(
  packageHandle: PackageHandle,
): (logicalKey: string) => string {
  const { urls } = NamedRoutes.use<RouteMap>()

  return React.useCallback(
    (logicalKey: string) => {
      const { bucket, name } = packageHandle
      const next = urls.bucketPackageDetail(bucket, name, { action: 'revisePackage' })
      const fileHandle = {
        bucket,
        key: s3paths.canonicalKey(name, logicalKey, cfg.packageRoot),
      }
      return editFileInPackage(urls, fileHandle, logicalKey, next)
    },
    [packageHandle, urls],
  )
}

export function useAddFileInbucket(bucket: string): (logicalKey: string) => string {
  const { urls } = NamedRoutes.use<RouteMap>()
  return React.useCallback(
    (logicalKey: string) => urls.bucketFile(bucket, logicalKey, { edit: true }),
    [bucket, urls],
  )
}

export function useParams() {
  const { bucket, path } = RRDom.useParams<{
    bucket: string
    path: string
  }>()
  invariant(bucket, '`bucket` must be defined')

  return { bucket, initialPath: s3paths.getPrefix(path) }
}
