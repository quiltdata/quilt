import cx from 'classnames'
import * as React from 'react'
import useResizeObserver from 'use-resize-observer'
import * as M from '@material-ui/core'

import * as BucketPreferences from 'utils/BucketPreferences'
import * as Dialogs from 'utils/Dialogs'
import * as Intercom from 'components/Intercom'
import assertNever from 'utils/assertNever'
import * as workflows from 'utils/workflows'

import * as Selection from '../Selection'
import * as Successors from '../Successors'
import * as requests from '../requests'

import DialogError from './DialogError'
import DialogLoading from './DialogLoading'
import DialogSuccess, { DialogSuccessRenderMessageProps } from './DialogSuccess'
import * as FI from './FilesInput'
import * as Layout from './Layout'
import * as MI from './MetaInput'
import * as PD from './PackageDialog'
import SelectWorkflow from './SelectWorkflow'
import * as State from './state'
import {
  FormSkeleton,
  MetaInputSkeleton,
  FilesInputSkeleton,
  WorkflowsInputSkeleton,
} from './Skeleton'
import SubmitSpinner from './SubmitSpinner'
// import { useUploads } from './Uploads'

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
  if (workflowsConfig._tag === 'loading') return <WorkflowsInputSkeleton />
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
      /*style*/
      InputLabelProps={{ shrink: true }}
      fullWidth
      margin="normal"
      /*constants*/
      helperText={<PD.PackageNameWarning />}
      disabled={formStatus._tag === 'submitting'}
      error={status._tag === 'error'}
      label="Name"
      placeholder="e.g. user/package"
      /*data*/
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
      /*style*/
      InputLabelProps={{ shrink: true }}
      fullWidth
      margin="normal"
      /*constants*/
      disabled={formStatus._tag === 'submitting'}
      error={status._tag === 'error'}
      helperText={status._tag === 'error' && status.error.message}
      label="Message"
      placeholder="Enter a commit message"
      /*data*/
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
    return <MetaInputSkeleton ref={ref} className={classes.root} />
  }
  return (
    <MI.MetaInput
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

const useInputFilesStyles = M.makeStyles((t) => ({
  root: {
    height: '100%',
    overflowY: 'auto',
  },
  error: {
    height: `calc(90% - ${t.spacing()}px)`,
  },
}))

function InputFiles() {
  const classes = useInputFilesStyles()
  const {
    formStatus,
    entriesSchema: schema,
    progress,
    values: {
      files: { initial, status, value, onChange },
    },
  } = State.use()
  // const uploads = useUploads()
  // const onFilesAction = React.useMemo(
  //   () =>
  //     FI.FilesAction.match({
  //       _: () => {},
  //       Revert: uploads.remove,
  //       RevertDir: uploads.removeByPrefix,
  //       Reset: uploads.reset,
  //     }),
  //   [uploads],
  // )
  const { prefs } = BucketPreferences.use()

  if (schema._tag === 'loading') return <FilesInputSkeleton className={classes.root} />

  return BucketPreferences.Result.match(
    {
      Ok: () => (
        <FI.FilesInput
          disabled={formStatus._tag === 'submitting' || formStatus._tag === 'success'}
          className={cx(classes.root, { [classes.error]: status._tag === 'error' })}
          value={value}
          initial={initial}
          onChange={onChange}
          error={status._tag === 'error' ? status.error : undefined}
          errors={status._tag === 'error' ? status.errors : undefined}
          title="Files"
          totalProgress={progress}
          // onFilesAction={onFilesAction}
        />
      ),
      Pending: () => <FilesInputSkeleton className={classes.root} />,
      Init: () => null,
    },
    prefs,
  )
}

export interface PackageCreationSuccess {
  name: string
  hash?: string
}

interface ConfirmReadmeProps {
  close: Dialogs.Close<'cancel' | 'empty' | 'readme'>
}

function ConfirmReadme({ close }: ConfirmReadmeProps) {
  return (
    <>
      <M.DialogTitle>Add a README file?</M.DialogTitle>
      <M.DialogContent>
        <M.DialogContentText>
          You are about to push an empty package.
          <br />
          Would you like to add a stub <b>README.md</b> file?
        </M.DialogContentText>
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={() => close('cancel')} color="primary">
          Cancel
        </M.Button>
        <M.Button onClick={() => close('empty')} color="primary" variant="outlined">
          Continue with empty package
        </M.Button>
        <M.Button onClick={() => close('readme')} color="primary" variant="contained">
          Add README.md
        </M.Button>
      </M.DialogActions>
    </>
  )
}

interface FormErrorProps {
  error: Error
}

function FormError({ error }: FormErrorProps) {
  // if (!error || error === CANCEL) return null
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

const useStyles = M.makeStyles((t) => ({
  files: {
    height: '100%',
    overflowY: 'auto',
  },
  filesWithError: {
    height: `calc(90% - ${t.spacing()}px)`,
  },
  filesError: {
    marginTop: t.spacing(),
    maxHeight: t.spacing(9),
    overflowY: 'auto',
  },
  form: {
    height: '100%',
  },
  meta: {
    display: 'flex',
    flexDirection: 'column',
    paddingTop: t.spacing(3),
    overflowY: 'auto',
  },
}))

interface PackageCreationFormProps {
  close: () => void
  currentBucketCanBeSuccessor: boolean
  disableStateDisplay: boolean
  ui?: {
    title?: React.ReactNode
    submit?: React.ReactNode
    resetFiles?: React.ReactNode
  }
}

function PackageCreationForm({
  close,
  currentBucketCanBeSuccessor,
  ui = {},
}: PackageCreationFormProps) {
  const { params, formStatus, dst, setDst, submit, progress, onAddReadme } = State.use()
  const classes = useStyles()
  const [editorElement, setEditorElement] = React.useState<HTMLDivElement | null>(null)
  const { height: metaHeight = 0 } = useResizeObserver({ ref: editorElement })
  const dialogContentClasses = PD.useContentStyles({ metaHeight })

  const successor = React.useMemo(() => workflows.bucketToSuccessor(dst.bucket), [dst])
  const handleSubmit = React.useCallback(
    (event) => {
      event.preventDefault()
      submit()
    },
    [submit],
  )

  return (
    <>
      {formStatus._tag === 'emptyFiles' && (
        <M.Dialog open fullWidth maxWidth="sm">
          <ConfirmReadme close={onAddReadme} />
        </M.Dialog>
      )}

      <M.DialogTitle>
        {ui.title || 'Create package'} in{' '}
        <Successors.Dropdown
          bucket={dst.bucket || ''}
          currentBucketCanBeSuccessor={currentBucketCanBeSuccessor}
          successor={successor}
          onChange={(s) => setDst((d) => ({ ...d, bucket: s.slug }))}
        />{' '}
        bucket
      </M.DialogTitle>
      <M.DialogContent classes={dialogContentClasses}>
        <form className={classes.form} onSubmit={handleSubmit}>
          <Layout.Container>
            <Layout.LeftColumn>
              <InputWorkflow />
              <InputName />
              <InputMessage />
              <InputMeta ref={setEditorElement} />
            </Layout.LeftColumn>
            <Layout.RightColumn>
              <InputFiles />
            </Layout.RightColumn>
          </Layout.Container>

          <input type="submit" style={{ display: 'none' }} />
        </form>
      </M.DialogContent>
      <M.DialogActions>
        {formStatus._tag === 'submitting' && (
          <SubmitSpinner value={progress.percent}>
            {progress.percent < 100 ? 'Uploading files' : 'Writing manifest'}
          </SubmitSpinner>
        )}

        {formStatus._tag === 'submitFailed' && !!formStatus.error && (
          <FormError error={formStatus.error} />
        )}

        <M.Button onClick={close} disabled={formStatus._tag === 'submitting'}>
          Cancel
        </M.Button>
        <M.Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          disabled={params._tag === 'invalid' || formStatus._tag === 'submitting'}
        >
          {ui.submit || 'Create'}
        </M.Button>
      </M.DialogActions>
    </>
  )
}

// const prependSourceBucket = (
//   buckets: BucketPreferences.SourceBuckets,
//   bucket: string,
// ): BucketPreferences.SourceBuckets =>
//   buckets.list.find((b) => b === bucket)
//     ? buckets
//     : {
//         getDefault: () => bucket,
//         list: R.prepend(bucket, buckets.list),
//       }

type DialogState =
  | { _tag: 'loading'; waitListing?: boolean }
  | { _tag: 'error'; error: Error }
  | { _tag: 'ready' }
  | { _tag: 'success'; bucket: string; name: string; hash: string }

interface PackageCreationDialogUIOptions {
  resetFiles?: React.ReactNode
  submit?: React.ReactNode
  successBrowse?: React.ReactNode
  successRenderMessage?: (props: DialogSuccessRenderMessageProps) => React.ReactNode
  successTitle?: React.ReactNode
  title?: React.ReactNode
}

interface RenderDialogProps {
  currentBucketCanBeSuccessor: boolean
  disableStateDisplay: boolean
  state: DialogState
  ui: PackageCreationDialogUIOptions
}

function RenderDialog({
  currentBucketCanBeSuccessor,
  disableStateDisplay,
  state,
  ui,
}: RenderDialogProps) {
  switch (state._tag) {
    case 'loading':
      return (
        <DialogLoading
          skeletonElement={<FormSkeleton />}
          title={
            state.waitListing
              ? 'Fetching list of files inside selected directories. It can take a while…'
              : 'Fetching package manifest. One moment…'
          }
          submitText={ui.submit}
          onCancel={close}
        />
      )
    case 'error':
      return (
        <DialogError
          error={state.error}
          skeletonElement={<FormSkeleton animate={false} />}
          title={ui.title || 'Create package'}
          submitText={ui.submit}
          onCancel={close}
        />
      )
    case 'success':
      return (
        <DialogSuccess
          name={state.name}
          hash={state.hash}
          bucket={state.bucket}
          onClose={close}
          browseText={ui.successBrowse}
          title={ui.successTitle}
          renderMessage={ui.successRenderMessage}
        />
      )
    case 'ready':
      return (
        <PackageCreationForm
          close={close}
          currentBucketCanBeSuccessor={currentBucketCanBeSuccessor}
          disableStateDisplay={disableStateDisplay}
          ui={ui}
        />
      )
    default:
      assertNever(state)
  }
}

interface UsePackageCreationDialogProps {
  s3Path?: string
  delayHashing?: boolean
  disableStateDisplay?: boolean
}

export function usePackageCreationDialog({
  s3Path,
  disableStateDisplay = false,
}: UsePackageCreationDialogProps = {}) {
  const {
    formStatus,
    setDst,
    reset,
    open: isOpen,
    setOpen,
    workflowsConfig,
  } = State.use()

  const [exited, setExited] = React.useState(!isOpen)
  const currentBucketCanBeSuccessor = s3Path !== undefined

  const [waitingListing, setWaitingListing] = React.useState(false)
  const getFiles = requests.useFilesListing()

  const open = React.useCallback(
    async (initial?: {
      successor?: workflows.Successor
      path?: string
      selection?: Selection.ListingSelection
    }) => {
      if (initial?.successor) {
        setDst((d) => (initial.successor ? { ...d, bucket: initial.successor.slug } : d))
      }

      setWaitingListing(true)
      setOpen(true)
      setExited(false)

      if (!initial?.selection) {
        setWaitingListing(false)
        return
      }
      const handles = Selection.toHandlesList(initial?.selection)
      const filesMap = await getFiles(handles)

      setOpen(filesMap)

      setWaitingListing(false)
    },
    [getFiles, setOpen, setDst],
  )

  const close = React.useCallback(() => {
    setOpen(false)
    reset()
  }, [reset, setOpen])

  const handleExited = React.useCallback(() => {
    setExited(true)
  }, [setExited])

  Intercom.usePauseVisibilityWhen(isOpen)

  const state: DialogState = React.useMemo<DialogState>(() => {
    if (formStatus._tag === 'success') return { _tag: 'success', ...formStatus.handle }
    if (waitingListing) return { _tag: 'loading', waitListing: true }
    if (workflowsConfig._tag === 'loading') return { _tag: 'loading', waitListing: true }
    if (workflowsConfig._tag === 'error')
      return { _tag: 'error', error: workflowsConfig.error }
    return { _tag: 'ready' }
  }, [waitingListing, workflowsConfig, formStatus])

  const render = (ui: PackageCreationDialogUIOptions = {}) => (
    <PD.DialogWrapper
      exited={exited}
      fullWidth
      maxWidth={formStatus._tag === 'success' ? 'sm' : 'lg'}
      onClose={close}
      onExited={handleExited}
      open={!!isOpen}
      scroll="body"
    >
      {!exited && (
        <RenderDialog
          currentBucketCanBeSuccessor={currentBucketCanBeSuccessor}
          disableStateDisplay={disableStateDisplay}
          state={state}
          ui={ui}
        />
      )}
    </PD.DialogWrapper>
  )

  return { open, close, render }
}
