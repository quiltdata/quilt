import invariant from 'invariant'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Code from 'components/Code'
import Lock from 'components/Lock'
import * as quiltConfigs from 'constants/quiltConfigs'
import { docs } from 'constants/urls'
import type * as Model from 'model'
import * as BucketPreferences from 'utils/BucketPreferences'
import { createBoundary } from 'utils/ErrorBoundary'
import * as Dialogs from 'utils/GlobalDialogs'
import Log from 'utils/Logging'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'

// TODO: put this into FileEditor/routes
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
  invariant(bucket, '`bucket` must be defined')

  const toConfig = useRouteToEditFile({ bucket, key: quiltConfigs.workflows })
  return <StyledLink to={toConfig}>{children}</StyledLink>
}

const Loading = Symbol('loading')

interface AddMissingSourceBucketProps {
  bucket: string
  close: Dialogs.Close
  onSubmit: () => Promise<void>
}

function MissingSourceBucketAddConfirmation({
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

const useMissingSourceBucketTooltipStyles = M.makeStyles({
  // browsers break the word on '-'
  nowrap: {
    whiteSpace: 'nowrap',
  },
})

function MissingSourceBucketTooltip() {
  const { bucket } = RRDom.useParams<{ bucket: string }>()
  invariant(bucket, '`bucket` must be defined')

  const classes = useMissingSourceBucketTooltipStyles()

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
        <MissingSourceBucketAddConfirmation
          bucket={bucket}
          close={close}
          onSubmit={autoAdd}
        />
      ),
      DIALOG_PROPS,
    )
  }, [autoAdd, bucket, open])

  return (
    <>
      <M.Typography variant="body2" gutterBottom>
        Config property <Code>ui.sourceBuckets</Code> is empty.{' '}
        <M.Link href={`${docs}/catalog/preferences`} target="_blank">
          Learn more
        </M.Link>
        .
      </M.Typography>
      <M.Typography variant="body2">
        <M.Link component={RRDom.Link} to={toConfig}>
          Edit manually
        </M.Link>{' '}
        or{' '}
        <M.Link onClick={showConfirmation}>
          <span className={classes.nowrap}>auto-add</span> current bucket (
          <span className={classes.nowrap}>s3://{bucket}</span>)
        </M.Link>
      </M.Typography>
    </>
  )
}

const ErrorBoundary = createBoundary(
  (props: Lab.AlertProps) => (error: Error) => (
    <Lab.Alert severity="error" {...props}>
      {error.message || 'Unexpected Error'}
    </Lab.Alert>
  ),
  'MissingSourceBucketErrorBoundary',
)

interface MissingSourceBucketProps {
  className?: string
  children: React.ReactNode
}

const tooltipStyles = M.makeStyles((t) => ({
  tooltip: {
    maxWidth: t.spacing(36),
  },
}))

export function MissingSourceBucket({ className, children }: MissingSourceBucketProps) {
  const classes = tooltipStyles()
  return (
    <M.Tooltip
      className={className}
      classes={classes}
      interactive
      title={
        <ErrorBoundary>
          <MissingSourceBucketTooltip />
        </ErrorBoundary>
      }
    >
      <div>{children}</div>
    </M.Tooltip>
  )
}
