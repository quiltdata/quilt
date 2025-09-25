import invariant from 'invariant'
import * as React from 'react'
import useResizeObserver from 'use-resize-observer'
import * as M from '@material-ui/core'

import * as Intercom from 'components/Intercom'
import cfg from 'constants/config'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import * as workflows from 'utils/workflows'

import SelectWorkflow from './PackageDialog/SelectWorkflow'
import * as PD from './PackageDialog'
import * as State from './PackageDialog/state'

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

function InputWorkflow() {
  const {
    formStatus,
    metadataSchema: schema,
    values: {
      workflow: { status, value, onChange },
    },
    workflowsConfig,
  } = State.use()
  const error = React.useMemo(() => {
    if (workflowsConfig._tag === 'error') return workflowsConfig.error.message
    if (status._tag === 'error') return status.error.message
    return undefined
  }, [status, workflowsConfig])
  if (workflowsConfig._tag === 'idle') return null
  if (workflowsConfig._tag === 'loading') return <PD.WorkflowsInputSkeleton />
  return (
    <SelectWorkflow
      disabled={schema._tag === 'loading' || formStatus._tag === 'submitting'}
      error={error}
      items={workflowsConfig.config.workflows}
      onChange={onChange}
      value={value}
    />
  )
}

function InputName() {
  const {
    formStatus,
    values: {
      name: { value, onChange, status },
    },
  } = State.use()
  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
    [onChange],
  )
  return (
    <M.TextField
      InputLabelProps={{ shrink: true }}
      fullWidth
      margin="normal"
      helperText={<PD.PackageNameWarning />}
      disabled={formStatus._tag === 'submitting'}
      error={status._tag === 'error'}
      label="Name"
      placeholder="e.g. user/package"
      onChange={handleChange}
      value={value || ''}
    />
  )
}

function InputMessage() {
  const {
    formStatus,
    values: {
      message: { status, value, onChange },
    },
  } = State.use()
  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
    [onChange],
  )
  return (
    <M.TextField
      InputLabelProps={{ shrink: true }}
      fullWidth
      margin="normal"
      disabled={formStatus._tag === 'submitting'}
      error={status._tag === 'error'}
      helperText={status._tag === 'error' && status.error.message}
      label="Message"
      placeholder="Enter a commit message"
      onChange={handleChange}
      value={value || ''}
    />
  )
}

const useInputMetaStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    paddingTop: t.spacing(3),
    overflowY: 'auto',
  },
}))

const InputMeta = React.forwardRef<HTMLDivElement>(function InputMeta(_, ref) {
  const classes = useInputMetaStyles()
  const {
    formStatus,
    metadataSchema: schema,
    values: {
      meta: { status, value, onChange },
    },
  } = State.use()
  const errors = React.useMemo(() => {
    if (schema._tag === 'error') return [schema.error]
    if (status._tag === 'error') return status.errors
    return []
  }, [schema, status])
  if (schema._tag === 'loading') {
    return <PD.MetaInputSkeleton ref={ref} className={classes.root} />
  }
  return (
    <PD.MetaInput
      disabled={formStatus._tag === 'submitting' || formStatus._tag === 'success'}
      className={classes.root}
      errors={errors}
      onChange={onChange}
      ref={ref}
      schema={schema._tag === 'ready' ? schema.schema : undefined}
      value={value}
    />
  )
})

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
  const { params, formStatus, src, copy, progress } = State.use()
  const classes = useStyles()
  const [editorElement, setEditorElement] = React.useState<HTMLDivElement | null>(null)
  const { height: metaHeight = 0 } = useResizeObserver({ ref: editorElement })
  const dialogContentClasses = PD.useContentStyles({ metaHeight })

  const handleCopy = React.useCallback(
    (event: React.FormEvent) => {
      event.preventDefault()
      invariant(src, 'Package handle must be provided')
      invariant(
        State.isPackageHandle(src),
        'Full package handle with hash must be provided',
      )
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
          <InputWorkflow />
          <InputName />
          <InputMessage />
          <InputMeta ref={setEditorElement} />
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
  const { formStatus, workflowsConfig, manifest, setOpen } = State.use()

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
