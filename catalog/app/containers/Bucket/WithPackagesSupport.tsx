import * as React from 'react'

import Message from 'components/Message'
import * as BucketConfig from 'utils/BucketConfig'
import * as Config from 'utils/Config'

interface WithPackagesSupportProps {
  bucket: string
  children: React.ReactNode
}

export default function WithPackagesSupport({
  bucket,
  children,
}: WithPackagesSupportProps) {
  const localMode = Config.use().mode === 'LOCAL'
  const isInStack = BucketConfig.useIsInStack()
  const inStack = React.useMemo(() => isInStack(bucket), [bucket, isInStack])

  return inStack || localMode ? (
    <>{children}</>
  ) : (
    <Message headline="Packages temporarily hidden">
      Ask an admin to add the bucket <strong>{bucket}</strong> to Quilt so that you can
      browse packages.
    </Message>
  )
}
