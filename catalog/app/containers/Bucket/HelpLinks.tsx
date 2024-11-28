import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'
import Code from 'components/Code'
import * as quiltConfigs from 'constants/quiltConfigs'
import type * as Model from 'model'
import * as BucketPreferences from 'utils/BucketPreferences'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import StyledTooltip from 'utils/StyledTooltip'

import * as requests from './requests'

// TODO: move it to components/FileEditor directory because purpose of this link is to edit file

function useRouteToEditFile(handle: Model.S3.S3ObjectLocation) {
  const { urls } = NamedRoutes.use()
  const { pathname, search } = RRDom.useLocation()
  const next = pathname + search
  return urls.bucketFile(handle.bucket, handle.key, { edit: true, next })
}

interface WrapperProps {
  children: React.ReactNode
}

export function WorkflowsConfigLink({ children }: WrapperProps) {
  const { bucket } = RRDom.useParams<{ bucket: string }>()
  const toConfig = useRouteToEditFile({ bucket, key: requests.WORKFLOWS_CONFIG_PATH })
  return <StyledLink to={toConfig}>{children}</StyledLink>
}

const useMissingSourceBucketStyles = M.makeStyles({
  nowrap: {
    whiteSpace: 'nowrap',
  },
})

interface MissingSourceBucketProps {
  className?: string
  children: React.ReactNode
}

export function MissingSourceBucket({ className, children }: MissingSourceBucketProps) {
  const { bucket } = RRDom.useParams<{ bucket: string }>()
  const classes = useMissingSourceBucketStyles()
  const { handle, update } = BucketPreferences.use()

  const toConfig = useRouteToEditFile(
    handle || { bucket, key: quiltConfigs.bucketPreferences[0] },
  )

  const [loading, setLoading] = React.useState(false)
  const handleAutoAdd = React.useCallback(async () => {
    setLoading(true)
    await update(BucketPreferences.sourceBucket(bucket))
    // Update triggers `handle` reset to `null`,
    // and `setLoading` applies to the unmounted component.
    // setLoading(false)
  }, [bucket, update])

  if (loading) return <Skeleton height={32} className={className} />

  return (
    <StyledTooltip
      className={className}
      interactive
      title={
        <>
          <M.Typography variant="body2" gutterBottom>
            Config property <Code>ui.sourceBuckets</Code> is empty.
          </M.Typography>
          <M.Typography variant="body2">
            <StyledLink to={toConfig}>Edit manually</StyledLink> or{' '}
            <StyledLink onClick={handleAutoAdd}>
              <span className={classes.nowrap}>auto-add</span> current bucket (
              <span className={classes.nowrap}>s3://{bucket}</span>)
            </StyledLink>
          </M.Typography>
        </>
      }
    >
      <div>{children}</div>
    </StyledTooltip>
  )
}
