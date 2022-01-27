import * as React from 'react'

import Message from 'components/Message'
import { docs } from 'constants/urls'
import * as BucketConfig from 'utils/BucketConfig'
import * as Config from 'utils/Config'
import StyledLink from 'utils/StyledLink'

const ADD_BUCKET_DOCS = `${docs}/catalog/admin#buckets`

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
    <Message headline="Packages not supported">
      Catalog does not support listing packages in out-of-stack buckets.
      <br />
      <StyledLink href={ADD_BUCKET_DOCS} target="_blank">
        Learn how to add this bucket to Quilt
      </StyledLink>{' '}
      to see the packages in it.
    </Message>
  )
}
