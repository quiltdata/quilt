import * as React from 'react'
import * as redux from 'react-redux'

import cfg from 'constants/config'
import * as authSelectors from 'containers/Auth/selectors'
import * as BucketConfig from 'utils/BucketConfig'
import { useStatusReportsBucket } from 'utils/StatusReportsBucket'

export default function useShouldSign() {
  const authenticated = redux.useSelector(authSelectors.authenticated)
  const isInStack = BucketConfig.useIsInStack()
  const statusReportsBucket = useStatusReportsBucket()

  return React.useCallback(
    (bucket: string | null | undefined) => {
      // always sign in local mode
      if (cfg.mode === 'LOCAL') return true

      // never sign if not authenticated
      if (!authenticated) return false

      // sign if operation is not bucket-specific
      // (not sure if there are any such operations that can be used from the browser)
      if (!bucket) return true

      // sign if bucket is attached to the current stack or is a special bucket from that stack
      return (
        bucket === statusReportsBucket ||
        bucket === cfg.serviceBucket ||
        isInStack(bucket)
      )
    },
    [authenticated, isInStack, statusReportsBucket],
  )
}
