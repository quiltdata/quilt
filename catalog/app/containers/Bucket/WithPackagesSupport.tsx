import * as React from 'react'

import Message from 'components/Message'
import cfg from 'constants/config'
import * as Buckets from 'utils/Buckets'

interface WithPackagesSupportProps {
  bucket: string
  children: React.ReactNode
}

export default function WithPackagesSupport({
  bucket,
  children,
}: WithPackagesSupportProps) {
  const isInStack = Buckets.useIsInStack()
  const inStack = React.useMemo(() => isInStack(bucket), [bucket, isInStack])

  return inStack || cfg.mode === 'LOCAL' ? (
    <>{children}</>
  ) : (
    <Message headline="Packages temporarily hidden">
      Ask an admin to add the bucket <strong>{bucket}</strong> to Quilt so that you can
      browse packages.
    </Message>
  )
}
