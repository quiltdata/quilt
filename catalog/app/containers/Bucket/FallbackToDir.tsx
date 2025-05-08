import * as React from 'react'
import * as R from 'ramda'
import * as RRDom from 'react-router-dom'

import Placeholder from 'components/Placeholder'
import * as Model from 'model'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as s3paths from 'utils/s3paths'

import * as requests from './requests'
import { displayError } from './errors'

interface FallbackToDirProps {
  children: React.ReactNode
  handle: Model.S3.S3ObjectLocation
}

export default function FallbackToDir({ children, handle }: FallbackToDirProps) {
  const s3 = AWS.S3.use()
  const { urls } = NamedRoutes.use()

  const objData = useData(requests.getObjectExistence, { s3, ...handle })

  const noAutoFetch = objData.case({
    Ok: requests.ObjectExistence.case({ Exists: R.T, _: R.F }),
    _: R.T,
  })

  const dirData = useData(requests.bucketListing, { s3, ...handle }, { noAutoFetch })

  const shouldRedirect: null | Error | boolean = objData.case({
    Ok: requests.ObjectExistence.case({
      Exists: () => false,
      _: () =>
        dirData.case({
          Ok: ({ dirs, files }: any) => !!dirs.length || !!files.length,
          Err: (e: Error) => e,
          _: () => null,
        }),
    }),
    Err: (e: Error) => e,
    _: () => null,
  })

  if (shouldRedirect === null) return <Placeholder color="text.secondary" />
  if (shouldRedirect instanceof Error) return displayError()(shouldRedirect)
  return shouldRedirect ? (
    <RRDom.Redirect to={urls.bucketDir(handle.bucket, s3paths.ensureSlash(handle.key))} />
  ) : (
    children
  )
}
