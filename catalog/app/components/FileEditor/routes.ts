import invariant from 'invariant'
import * as React from 'react'
import * as RRDom from 'react-router-dom'

import cfg from 'constants/config'
import type * as Routes from 'constants/routes'
import type * as Model from 'model'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as PackageUri from 'utils/PackageUri'
import type { PackageHandle } from 'utils/packageHandle'
import * as s3paths from 'utils/s3paths'

interface RouteMap {
  bucketFile: Routes.BucketFileArgs
  bucketPackageDetail: Routes.BucketPackageDetailArgs
}

export function useEditFileInPackage(
  packageHandle: PackageHandle,
  fileHandle: Model.S3.S3ObjectLocation,
): (logicalKey: string) => string {
  const { urls } = NamedRoutes.use<RouteMap>()
  return React.useCallback(
    (logicalKey: string) =>
      urls.bucketFile(fileHandle.bucket, fileHandle.key, {
        add: PackageUri.stringify({
          bucket: packageHandle.bucket,
          name: packageHandle.name,
          path: logicalKey,
        }),
        edit: true,
      }),
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
      invariant(logicalKey, '`logicalKey` can not be empty')

      const key = s3paths.canonicalKey(name, logicalKey, cfg.packageRoot)
      return urls.bucketFile(bucket, key, {
        add: PackageUri.stringify({
          bucket,
          name,
          path: logicalKey,
        }),
        edit: true,
      })
    },
    [packageHandle, urls],
  )
}

export function useAddFileInBucket(bucket: string): (logicalKey: string) => string {
  const { urls } = NamedRoutes.use<RouteMap>()
  return React.useCallback(
    (logicalKey: string) => urls.bucketFile(bucket, logicalKey, { edit: true }),
    [bucket, urls],
  )
}

export function useEditBucketFile(handle: Model.S3.S3ObjectLocation): string {
  const { urls } = NamedRoutes.use<RouteMap>()
  const { pathname, search } = RRDom.useLocation()
  const next = pathname + search
  return urls.bucketFile(handle.bucket, handle.key, { edit: true, next })
}

export function useParams() {
  const { bucket, path } = RRDom.useParams<{
    bucket: string
    path: string
  }>()
  invariant(bucket, '`bucket` must be defined')

  return { bucket, initialPath: s3paths.getPrefix(path) }
}
