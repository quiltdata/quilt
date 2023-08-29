import * as React from 'react'
import invariant from 'invariant'
import { Outlet, useParams } from 'react-router-dom'

import BucketLayout from 'embed/BucketLayout'

export default function Bucket() {
  const { bucket } = useParams<{ bucket: string }>()
  invariant(!!bucket, '`bucket` must be defined')

  return (
    <BucketLayout bucket={bucket}>
      <Outlet />
    </BucketLayout>
  )
}

export const Component: React.FC = Bucket
