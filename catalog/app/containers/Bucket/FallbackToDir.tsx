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

type RequestResult<T> = typeof Loading | Error | T

function useRequest<T>(req: () => Promise<T>, proceed: boolean = true): RequestResult<T> {
  const [result, setResult] = React.useState<RequestResult<T>>(Loading)

  const currentReq = React.useRef<Promise<T>>()

  React.useEffect(() => {
    setResult(Loading)

    if (!proceed) {
      currentReq.current = undefined
      return
    }

    const p = req()
    currentReq.current = p

    function handleResult(r: T | Error) {
      // if the request is not the current one, ignore the result
      if (currentReq.current === p) setResult(r)
    }

    p.then(handleResult, handleResult)
  }, [req, proceed])

  // cleanup on unmount
  React.useEffect(
    () => () => {
      currentReq.current = undefined
    },
    [],
  )

  return result
}

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

  return useRequest<boolean>(req)
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

  return useRequest(req, proceed)
}

function useFallbackToDir(handle: Model.S3.S3ObjectLocation) {
  const isObject = useIsObject(handle)
  const isDirectory = useIsDirectory(handle, !isObject)

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
