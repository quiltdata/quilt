import * as React from 'react'
import * as RRDom from 'react-router-dom'

import Placeholder from 'components/Placeholder'
import * as Model from 'model'
import * as AWS from 'utils/AWS'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as s3paths from 'utils/s3paths'

import * as requests from './requests'
import { displayError } from './errors'

function useIsObject(handle: Model.S3.S3ObjectLocation) {
  const [exists, setExists] = React.useState(null)

  const s3 = AWS.S3.use()
  React.useEffect(() => {
    const { bucket, key, version } = handle
    function resolveObjectExistence() {
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
    }
    resolveObjectExistence()
  }, [s3, handle])

  return exists
}

function useIsDirectory(handle: Model.S3.S3ObjectLocation) {
  const bucketListing = requests.useBucketListing()
  return React.useCallback(async () => {
    const { bucket, key } = handle
    const path = s3paths.ensureSlash(key)
    const { dirs, files } = await bucketListing({ bucket, path, maxKeys: 1 })
    // If prefix contains at least something, then it is a directory.
    // S3 can not have empty directories, because directories are virtual,
    //    they are based on paths for existing keys (file)
    return !!dirs.length || !!files.length
  }, [bucketListing, handle])
}

interface HandleNoSlashDirProps {
  children: React.ReactNode
  handle: Model.S3.S3ObjectLocation
}

export default function HandleNoSlashDir({ children, handle }: HandleNoSlashDirProps) {
  const { urls } = NamedRoutes.use()

  const isObject = useIsObject(handle)
  const requestIsDirectory = useIsDirectory(handle)

  const [isDir, setIsDir] = React.useState<null | boolean | Error>(null)

  React.useEffect(() => {
    function fetchData() {
      if (isObject === null) return

      if (isObject) {
        // If object exists, then this is 100% an object page
        setIsDir(false)
      }

      // If directory request does not fail,
      // and we already checked it is not a file,
      // then it may be a directory.
      requestIsDirectory()
        .then(setIsDir)
        .catch(() => setIsDir(false))
    }
    fetchData()
  }, [handle, isObject, requestIsDirectory])

  if (isDir === null) return <Placeholder color="text.secondary" />

  if (isDir instanceof Error) return displayError()(isDir)

  return isDir ? (
    <RRDom.Redirect to={urls.bucketDir(handle.bucket, s3paths.ensureSlash(handle.key))} />
  ) : (
    children
  )
}
