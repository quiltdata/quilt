import invariant from 'invariant'
import * as React from 'react'
import useResizeObserver from 'use-resize-observer'
import * as M from '@material-ui/core'

import * as Intercom from 'components/Intercom'
import cfg from 'constants/config'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import assertNever from 'utils/assertNever'
import * as workflows from 'utils/workflows'

import PDDialogError from './DialogError'
import PDDialogLoading from './DialogLoading'
import PDDialogSuccess from './DialogSuccess'
import * as Inputs from './Inputs'
import * as Layout from './Layout'
import * as Skeleton from './Skeleton'
import * as State from './State'
import { isPackageHandle } from './State/manifest'
import SubmitSpinner from './SubmitSpinner'

const useFormSkeletonStyles = M.makeStyles((t) => ({
  meta: {
    marginTop: t.spacing(3),
  },
}))

interface FormSkeletonProps {
  animate?: boolean
}

function FormSkeleton({ animate }: FormSkeletonProps) {
  const classes = useFormSkeletonStyles()

  return (
    <>
      <Skeleton.WorkflowsInputSkeleton animate={animate} />
      <Skeleton.TextFieldSkeleton animate={animate} />
      <Skeleton.TextFieldSkeleton animate={animate} />
      <Skeleton.MetaInputSkeleton className={classes.meta} animate={animate} />
    </>
  )
}

interface DialogTitleProps {
  bucket: string
}

function DialogTitle({ bucket }: DialogTitleProps) {
  const { urls } = NamedRoutes.use()

  return (
    <M.DialogTitle>
      Push package to{' '}
      <StyledLink target="_blank" to={urls.bucketOverview(bucket)}>
        {bucket}
      </StyledLink>{' '}
      bucket
    </M.DialogTitle>
  )
}

const useStyles = M.makeStyles((t) => ({
  form: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflowY: 'auto',
  },
  meta: {
    display: 'flex',
    flexDirection: 'column',
    paddingTop: t.spacing(3),
    overflowY: 'auto',
  },
}))

interface FormErrorProps {
  error: Error
}

function FormError({ error }: FormErrorProps) {
  return (
    <M.Box flexGrow={1} display="flex" alignItems="center" pl={2}>
      <M.Icon color="error">error_outline</M.Icon>
      <M.Box pl={1} />
      <M.Typography variant="body2" color="error">
        {error.message}
      </M.Typography>
    </M.Box>
  )
}

interface PackageCopyFormProps {
  close: () => void
  successor: workflows.Successor
}

function PackageCopyForm({ close, successor }: PackageCopyFormProps) {
  const {
    copy,
    formStatus,
    message,
    meta,
    metadataSchema,
    name,
    params,
    progress,
    setSrc,
    src,
    workflow,
    workflowsConfig,
  } = State.useContext()
  const classes = useStyles()

  const [editorElement, setEditorElement] = React.useState<HTMLDivElement | null>(null)
  const { height: metaHeight = 0 } = useResizeObserver({ ref: editorElement })
  const dialogContentClasses = Layout.useContentStyles({ metaHeight })

  const handleCopy = React.useCallback(
    (event: React.FormEvent) => {
      event.preventDefault()
      invariant(src, 'Package handle must be provided')
      invariant(isPackageHandle(src), 'Full package handle with hash must be provided')
      const destPrefix = successor.copyData && cfg.packageRoot ? cfg.packageRoot : null
      copy(src, destPrefix)
    },
    [copy, src, successor],
  )

  return (
    <>
      <DialogTitle bucket={successor.slug} />
      <M.DialogContent classes={dialogContentClasses}>
        <form className={classes.form} onSubmit={handleCopy}>
          <Inputs.Workflow
            formStatus={formStatus}
            schema={metadataSchema}
            state={workflow}
            config={workflowsConfig}
          />
          <Inputs.Name formStatus={formStatus} state={name} setSrc={setSrc} />
          <Inputs.Message formStatus={formStatus} state={message} />
          <Inputs.Meta
            formStatus={formStatus}
            schema={metadataSchema}
            state={meta}
            ref={setEditorElement}
          />
          <input type="submit" style={{ display: 'none' }} />
        </form>
      </M.DialogContent>
      <M.DialogActions>
        {formStatus._tag === 'submitting' && (
          <SubmitSpinner value={progress.percent}>
            {successor.copyData
              ? 'Copying files and writing manifest'
              : 'Writing manifest'}
          </SubmitSpinner>
        )}

        {formStatus._tag === 'error' && !!formStatus.error && (
          <FormError error={formStatus.error} />
        )}

        <M.Button disabled={formStatus._tag === 'submitting'} onClick={close}>
          Cancel
        </M.Button>
        <M.Button
          onClick={handleCopy}
          variant="contained"
          color="primary"
          disabled={params._tag === 'invalid' || formStatus._tag === 'submitting'}
        >
          Push
        </M.Button>
      </M.DialogActions>
    </>
  )
}

interface DialogErrorProps {
  bucket: string
  error: Error
}

function DialogError({ bucket, error }: DialogErrorProps) {
  const { urls } = NamedRoutes.use()

  return (
    <PDDialogError
      error={error}
      skeletonElement={<FormSkeleton animate={false} />}
      title={
        <>
          Push package to{' '}
          <StyledLink target="_blank" to={urls.bucketOverview(bucket)}>
            {bucket}
          </StyledLink>{' '}
          bucket
        </>
      }
      onCancel={() => {}}
    />
  )
}

interface DialogLoadingProps {
  bucket: string
}

function DialogLoading({ bucket }: DialogLoadingProps) {
  const { urls } = NamedRoutes.use()

  return (
    <PDDialogLoading
      skeletonElement={<FormSkeleton />}
      title={
        <>
          Push package to{' '}
          <StyledLink target="_blank" to={urls.bucketOverview(bucket)}>
            {bucket}
          </StyledLink>{' '}
          bucket
        </>
      }
      onCancel={() => {}}
    />
  )
}

interface RenderDialogProps {
  close: () => void
  state: DialogState
  successor: workflows.Successor
}

function RenderDialog({ close, state, successor }: RenderDialogProps) {
  switch (state._tag) {
    case 'loading':
      return <DialogLoading bucket={successor.slug} />
    case 'error':
      return <DialogError bucket={successor.slug} error={state.error} />
    case 'success':
      return (
        <PDDialogSuccess
          name={state.name}
          hash={state.hash}
          bucket={state.bucket}
          onClose={close}
        />
      )
    case 'ready':
      return <PackageCopyForm successor={successor} close={close} />
    default:
      assertNever(state)
  }
}

type DialogState =
  | { _tag: 'loading'; waitListing?: boolean }
  | { _tag: 'error'; error: Error }
  | { _tag: 'ready' }
  | { _tag: 'success'; bucket: string; name: string; hash: string }

interface PackageCopyDialogProps {
  successor: workflows.Successor | null
  onClose: () => void
}

export default function PackageCopyDialog({
  successor,
  onClose,
}: PackageCopyDialogProps) {
  const { formStatus, workflowsConfig, manifest, setOpen } = State.useContext()

  React.useEffect(() => {
    setOpen(!!successor)
  }, [setOpen, successor])

  const close = React.useCallback(() => {
    if (formStatus._tag === 'submitting') return
    onClose()
  }, [formStatus, onClose])

  Intercom.usePauseVisibilityWhen(!!successor)

  const state: DialogState = React.useMemo<DialogState>(() => {
    if (formStatus._tag === 'success') return { _tag: 'success', ...formStatus.handle }
    if (workflowsConfig._tag === 'loading' || manifest._tag === 'loading') {
      return { _tag: 'loading' }
    }
    if (manifest._tag === 'error') {
      return { _tag: 'error', error: manifest.error }
    }
    if (workflowsConfig._tag === 'error') {
      return { _tag: 'error', error: workflowsConfig.error }
    }
    return { _tag: 'ready' }
  }, [workflowsConfig, formStatus, manifest])

  if (!successor) return null

  return (
    <M.Dialog fullWidth onClose={close} open={!!successor} scroll="body">
      {successor && <RenderDialog successor={successor} close={close} state={state} />}
    </M.Dialog>
  )
}
