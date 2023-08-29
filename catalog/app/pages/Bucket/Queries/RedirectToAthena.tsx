import invariant from 'invariant'
import * as React from 'react'
import { Navigate, useParams } from 'react-router-dom'

import * as routes from 'constants/routes'

export default function RedirectToAthena() {
  const { bucket } = useParams<{ bucket: string }>()
  invariant(!!bucket, '`bucket` must be defined')
  return <Navigate to={routes.bucketAthena.url(bucket)} />
}
