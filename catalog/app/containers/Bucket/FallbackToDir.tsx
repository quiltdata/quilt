import * as React from 'react'
import * as RRDom from 'react-router-dom'

import Placeholder from 'components/Placeholder'
import * as Model from 'model'
import * as AWS from 'utils/AWS'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as s3paths from 'utils/s3paths'
import * as Request from 'utils/useRequest'
import assertNever from 'utils/assertNever'

import * as requests from './requests'
import { displayError } from './errors'

const Dir = Symbol('dir')

const File = Symbol('file')

// If object exists, then this is 100% an object page
function useIsObject(handle: Model.S3.S3ObjectLocation) {
  const s3 = AWS.S3.use()
  const { bucket, key, version } = handle
  const req = React.useCallback(
    () =>
      requests
        .getObjectExistence({ s3, bucket, key, version })
        .then(requests.ObjectExistence.case({ Exists: () => true, _: () => false })),
    [s3, bucket, key, version],
  )

  return Request.use<boolean>(req)
}

// If prefix contains at least something, then it is a directory.
// S3 can not have empty directories, because directories are virtual,
//    they are based on paths for existing keys (file)
function useIsDirectory(handle: Model.S3.S3ObjectLocation, proceed: boolean) {
  const bucketListing = requests.useBucketListing()

  const { bucket, key } = handle
  const path = s3paths.ensureSlash(key)
  const req = React.useCallback(
    () =>
      bucketListing({ bucket, path, maxKeys: 1 }).then(
        ({ dirs, files }) => !!dirs.length || !!files.length,
      ),

    [bucketListing, bucket, path],
  )

  return Request.use(req, proceed)
}

function useFallbackToDir(handle: Model.S3.S3ObjectLocation) {
  const { result: isObject } = useIsObject(handle)
  const { result: isDirectory } = useIsDirectory(handle, !isObject)

  if (
    isObject === Request.Idle ||
    isObject === Request.Loading ||
    isObject instanceof Error
  ) {
    return isObject
  }

  if (isObject) return File

  if (
    isDirectory === Request.Idle ||
    isDirectory === Request.Loading ||
    isDirectory instanceof Error
  ) {
    return isDirectory
  }

  return isDirectory ? Dir : File
}

interface FallbackToDirProps {
  children: React.ReactNode
  handle: Model.S3.S3ObjectLocation
}

export default function FallbackToDir({ children, handle }: FallbackToDirProps) {
  const { urls } = NamedRoutes.use()

  const pageType = useFallbackToDir(handle)

  if (pageType instanceof Error) return <>{displayError()(pageType)}</>

  switch (pageType) {
    case Request.Idle:
      return null
    case Request.Loading:
      return <Placeholder color="text.secondary" />
    case Dir:
      const dirPage = urls.bucketDir(handle.bucket, s3paths.ensureSlash(handle.key))
      return <RRDom.Redirect to={dirPage} />
    case File:
      return <>{children}</>
    default:
      assertNever(pageType)
  }
}
