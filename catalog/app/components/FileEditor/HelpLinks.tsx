import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Code from 'components/Code'
import Lock from 'components/Lock'
import * as quiltConfigs from 'constants/quiltConfigs'
import type * as Model from 'model'
import * as BucketPreferences from 'utils/BucketPreferences'
import * as Dialogs from 'utils/GlobalDialogs'
import Log from 'utils/Logging'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import StyledTooltip from 'utils/StyledTooltip'

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
  const toConfig = useRouteToEditFile({ bucket, key: quiltConfigs.workflows })
  return <StyledLink to={toConfig}>{children}</StyledLink>
}

const Loading = Symbol('loading')

interface AddMissingSourceBucketProps {
  bucket: string
  close: Dialogs.Close
  onSubmit: () => Promise<void>
}

function AddMissingSourceBucket({
  bucket,
  close,
  onSubmit,
}: AddMissingSourceBucketProps) {
  const [state, setState] = React.useState<typeof Loading | Error | void>()
  const handleSubmit = React.useCallback(async () => {
    setState(Loading)
    try {
      await onSubmit()

      setState()
      close()
    } catch (error) {
      Log.error(error)
      setState(error instanceof Error ? error : new Error('Unknown error'))
    }
  }, [close, onSubmit])
  return (
    <>
      <M.DialogTitle>Add {bucket} to the source buckets list</M.DialogTitle>
      {state instanceof Error && (
        <M.DialogContent>
          <Lab.Alert severity="error">{state.message}</Lab.Alert>
        </M.DialogContent>
      )}
      {state === Loading && (
        <Lock>
          <M.CircularProgress size={32} />
        </Lock>
      )}
      <M.DialogActions>
        <M.Button onClick={close} disabled={state === Loading}>
          Cancel
        </M.Button>
        <M.Button
          color="primary"
          disabled={state === Loading}
          onClick={handleSubmit}
          variant="contained"
        >
          Update config
        </M.Button>
      </M.DialogActions>
    </>
  )
}

const DIALOG_PROPS = {
  maxWidth: 'sm' as const,
  fullWidth: true,
}

const useMissingSourceBucketStyles = M.makeStyles({
  // browsers break the word on '-'
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

  const open = Dialogs.use()

  const autoAdd = React.useCallback(async () => {
    await update(BucketPreferences.sourceBucket(bucket))
  }, [bucket, update])

  const showConfirmation = React.useCallback(() => {
    open(
      ({ close }) => (
        <AddMissingSourceBucket bucket={bucket} close={close} onSubmit={autoAdd} />
      ),
      DIALOG_PROPS,
    )
  }, [autoAdd, bucket, open])

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
            <StyledLink onClick={showConfirmation}>
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
