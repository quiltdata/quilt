import * as React from 'react'
import * as RRDom from 'react-router-dom'

import Placeholder from 'components/Placeholder'
import * as Model from 'model'
import * as AWS from 'utils/AWS'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as s3paths from 'utils/s3paths'

import * as requests from './requests'
import { displayError } from './errors'

const Loading = Symbol('loading')

const Dir = Symbol('dir')

const File = Symbol('file')

// If object exists, then this is 100% an object page
function useIsObject(handle: Model.S3.S3ObjectLocation) {
  const s3 = AWS.S3.use()
  const [exists, setExists] = React.useState<typeof Loading | boolean | Error>(Loading)

  React.useEffect(() => {
    const { bucket, key, version } = handle
    requests
      .getObjectExistence({
        s3,
        bucket,
        key,
        version,
      })
      .then(
        requests.ObjectExistence.case({
          Exists: () => true,
          _: () => false,
        }),
      )
      .then(setExists)
      .catch(setExists)
  }, [s3, handle])

  return exists
}

// If prefix contains at least something, then it is a directory.
// S3 can not have empty directories, because directories are virtual,
//    they are based on paths for existing keys (file)
function useIsDirectory(handle: Model.S3.S3ObjectLocation, pause: boolean) {
  const bucketListing = requests.useBucketListing()
  const [isDir, setIsDir] = React.useState<typeof Loading | boolean | Error>(Loading)

  React.useEffect(() => {
    if (pause) return

    const { bucket, key } = handle
    const path = s3paths.ensureSlash(key)
    bucketListing({ bucket, path, maxKeys: 1 })
      .then(({ dirs, files }) => setIsDir(!!dirs.length || !!files.length))
      .catch((e) => setIsDir(e instanceof Error ? e : new Error(`${e}`)))
  }, [bucketListing, handle, pause])

  return isDir
}

function useFallbackToDir(handle: Model.S3.S3ObjectLocation) {
  const isObject = useIsObject(handle)
  const isDirectory = useIsDirectory(handle, isObject === Loading)

  if (isObject === Loading || isObject instanceof Error) return isObject

  if (isObject) return File

  if (isDirectory === Loading || isDirectory instanceof Error) return isDirectory

  return isDirectory ? Dir : File
}

interface FallbackToDirProps {
  children: React.ReactNode
  handle: Model.S3.S3ObjectLocation
}

export default function FallbackToDir({ children, handle }: FallbackToDirProps) {
  const { urls } = NamedRoutes.use()

  const pageType = useFallbackToDir(handle)

  switch (pageType) {
    case Loading:
      return <Placeholder color="text.secondary" />
    case Dir:
      const dirPage = urls.bucketDir(handle.bucket, s3paths.ensureSlash(handle.key))
      return <RRDom.Redirect to={dirPage} />
    case File:
      return <>{children}</>
    default:
      return <>{displayError()(pageType)}</>
  }
}
