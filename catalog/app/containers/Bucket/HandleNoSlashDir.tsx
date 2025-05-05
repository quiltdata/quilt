import * as React from 'react'
import * as RRDom from 'react-router-dom'

import Placeholder from 'components/Placeholder'
import * as Model from 'model'
import * as AWS from 'utils/AWS'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as s3paths from 'utils/s3paths'

import * as requests from './requests'
import { displayError } from './errors'

// If object exists, then this is 100% an object page
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

// If prefix contains at least something, then it is a directory.
// S3 can not have empty directories, because directories are virtual,
//    they are based on paths for existing keys (file)
function useIsDirectory(handle: Model.S3.S3ObjectLocation) {
  const bucketListing = requests.useBucketListing()
  return React.useCallback(async () => {
    const { bucket, key } = handle
    const path = s3paths.ensureSlash(key)
    const { dirs, files } = await bucketListing({ bucket, path, maxKeys: 1 })
    return !!dirs.length || !!files.length
  }, [bucketListing, handle])
}

function useHandleNoSlashDir(
  handle: Model.S3.S3ObjectLocation,
): 'loading' | 'dir' | 'file' | Error {
  const isObject = useIsObject(handle)
  const requestIsDirectory = useIsDirectory(handle)

  const [pageType, setPageType] = React.useState<'loading' | 'dir' | 'file' | Error>(
    'loading',
  )

  React.useEffect(() => {
    function fetchData() {
      if (isObject === null) return

      if (isObject) {
        setPageType('file')
        return
      }

      requestIsDirectory()
        .then((isDir) => setPageType(isDir ? 'dir' : 'file'))
        .catch((e) => setPageType(e instanceof Error ? e : new Error(`${e}`)))
    }
    fetchData()
  }, [handle, isObject, requestIsDirectory])

  return pageType
}

interface HandleNoSlashDirProps {
  children: React.ReactNode
  handle: Model.S3.S3ObjectLocation
}

export default function HandleNoSlashDir({ children, handle }: HandleNoSlashDirProps) {
  const { urls } = NamedRoutes.use()

  const pageType = useHandleNoSlashDir(handle)

  switch (pageType) {
    case 'loading':
      return <Placeholder color="text.secondary" />
    case 'dir':
      const dirPage = urls.bucketDir(handle.bucket, s3paths.ensureSlash(handle.key))
      return <RRDom.Redirect to={dirPage} />
    case 'file':
      return children
    default:
      displayError()(pageType)
  }
}
