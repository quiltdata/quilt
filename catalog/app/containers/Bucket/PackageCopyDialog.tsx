import invariant from 'invariant'
import * as React from 'react'
import useResizeObserver from 'use-resize-observer'
import * as M from '@material-ui/core'

import * as Intercom from 'components/Intercom'
import cfg from 'constants/config'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import * as workflows from 'utils/workflows'

import * as PD from './PackageDialog'

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
      <PD.WorkflowsInputSkeleton animate={animate} />
      <PD.TextFieldSkeleton animate={animate} />
      <PD.TextFieldSkeleton animate={animate} />
      <PD.MetaInputSkeleton className={classes.meta} animate={animate} />
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
  successor: workflows.Successor
}

function PackageCopyForm({ successor }: PackageCopyFormProps) {
  const { params, formStatus, src, copy, progress } = PD.useContext()
  const classes = useStyles()
  const [editorElement, setEditorElement] = React.useState<HTMLDivElement | null>(null)
  const { height: metaHeight = 0 } = useResizeObserver({ ref: editorElement })
  const dialogContentClasses = PD.useContentStyles({ metaHeight })

  const handleCopy = React.useCallback(
    (event: React.FormEvent) => {
      event.preventDefault()
      invariant(src, 'Package handle must be provided')
      invariant(PD.isPackageHandle(src), 'Full package handle with hash must be provided')
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
          <PD.Inputs.Workflow />
          <PD.Inputs.Name />
          <PD.Inputs.Message />
          <PD.Inputs.Meta ref={setEditorElement} />
          <input type="submit" style={{ display: 'none' }} />
        </form>
      </M.DialogContent>
      <M.DialogActions>
        {formStatus._tag === 'submitting' && (
          <PD.SubmitSpinner value={progress.percent}>
            {successor.copyData
              ? 'Copying files and writing manifest'
              : 'Writing manifest'}
          </PD.SubmitSpinner>
        )}

        {formStatus._tag === 'submitFailed' && !!formStatus.error && (
          <FormError error={formStatus.error} />
        )}

        <M.Button disabled={formStatus._tag === 'submitting'}>Cancel</M.Button>
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
    <PD.DialogError
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
    <PD.DialogLoading
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

interface PackageCopyDialogProps {
  successor: workflows.Successor | null
  onClose: () => void
}

export default function PackageCopyDialog({
  successor,
  onClose,
}: PackageCopyDialogProps) {
  const { formStatus, workflowsConfig, manifest, setOpen } = PD.useContext()

  React.useEffect(() => {
    setOpen(!!successor)
  }, [setOpen, successor])

  const close = React.useCallback(() => {
    if (formStatus._tag === 'submitting') return
    onClose()
  }, [formStatus, onClose])

  Intercom.usePauseVisibilityWhen(!!successor)

  if (!successor) return null

  return (
    <M.Dialog fullWidth onClose={close} open={!!successor} scroll="body">
      {(() => {
        if (formStatus._tag === 'success') {
          return (
            <PD.DialogSuccess
              name={formStatus.handle.name}
              hash={formStatus.handle.hash}
              bucket={formStatus.handle.bucket}
              onClose={close}
            />
          )
        }

        if (workflowsConfig._tag === 'error') {
          return <DialogError bucket={successor.slug} error={workflowsConfig.error} />
        }

        if (manifest._tag === 'error') {
          return <DialogError bucket={successor.slug} error={manifest.error} />
        }

        if (workflowsConfig._tag === 'loading' || manifest._tag === 'loading') {
          return <DialogLoading bucket={successor.slug} />
        }

        return <PackageCopyForm successor={successor} />
      })()}
    </M.Dialog>
  )
}
