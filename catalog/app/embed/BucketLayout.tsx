import * as React from 'react'
import * as M from '@material-ui/core'

import Placeholder from 'components/Placeholder'
import { displayError } from 'containers/Bucket/errors'
import * as BucketCache from 'utils/BucketCache'

import AppBar from './AppBar'

interface BucketLayoutProps {
  bucket: string
  children: React.ReactNode
}

export default function BucketLayout({ bucket, children }: BucketLayoutProps) {
  const data = BucketCache.useBucketExistence(bucket)
  return (
    <>
      <AppBar bucket={bucket} />
      <M.Container maxWidth="lg">
        {data.case({
          Ok: () => children,
          Err: displayError(),
          _: () => <Placeholder color="text.secondary" />,
        })}
      </M.Container>
      <M.Box flexGrow={1} />
    </>
  )
}
