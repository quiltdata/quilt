import * as React from 'react'
import * as R from 'ramda'
import * as RRDom from 'react-router-dom'

import Placeholder from 'components/Placeholder'
import * as Model from 'model'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import AsyncResult from 'utils/AsyncResult'
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

  const noAutoFetch = React.useMemo(
    () =>
      AsyncResult.case(
        {
          Ok: requests.ObjectExistence.case({ Exists: R.T, _: R.F }),
          _: R.T,
        },
        objData.result,
      ),
    [objData.result],
  )

  const dirData = useData(requests.bucketListing, { s3, ...handle }, { noAutoFetch })

  const redirectResult = React.useMemo(
    () =>
      AsyncResult.case(
        {
          Ok: requests.ObjectExistence.case({
            Exists: R.F,
            _: () =>
              AsyncResult.mapCase(
                {
                  Ok: (isDirectory: boolean) =>
                    isDirectory
                      ? urls.bucketDir(handle.bucket, s3paths.ensureSlash(handle.key))
                      : undefined,
                },
                dirData.result,
              ),
          }),
          Err: AsyncResult.Err,
          Pending: AsyncResult.Pending,
          Init: AsyncResult.Init,
        },
        objData.result,
      ),
    [objData.result, dirData.result, handle, urls],
  )

  return AsyncResult.case(
    {
      Ok: (to?: string) => (to ? <RRDom.Redirect to={to} /> : children),
      Err: displayError(),
      _: () => <Placeholder color="text.secondary" />,
    },
    redirectResult,
  )
}
