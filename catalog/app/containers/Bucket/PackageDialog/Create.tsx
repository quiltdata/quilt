import * as React from 'react'
import useResizeObserver from 'use-resize-observer'
import * as M from '@material-ui/core'

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
import * as Inputs from './Inputs'
import * as Layout from './Layout'
import * as PDModel from './State'
import { FormSkeleton } from './Skeleton'
import SubmitSpinner from './SubmitSpinner'
// import { useUploads } from './Uploads'

interface DialogWrapperProps {
  exited: boolean
}

function DialogWrapper({
  exited,
  ...props
}: DialogWrapperProps & React.ComponentProps<typeof M.Dialog>) {
  const refProps = { exited, onExited: props.onExited }
  const ref = React.useRef<typeof refProps>()
  ref.current = refProps
  React.useEffect(
    () => () => {
      // call onExited on unmount if it has not been called yet
      if (!ref.current!.exited && ref.current!.onExited)
        (ref.current!.onExited as () => void)()
    },
    [],
  )
  return <M.Dialog {...props} />
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
  delayHashing: boolean
  state: PDModel.State
  ui?: {
    title?: React.ReactNode
    submit?: React.ReactNode
    resetFiles?: React.ReactNode
  }
}

function PackageCreationForm({
  close,
  currentBucketCanBeSuccessor,
  delayHashing,
  state,
  ui = {},
}: PackageCreationFormProps) {
  const {
    create,
    dst,
    entriesSchema,
    files,
    formStatus,
    message,
    meta,
    metadataSchema,
    name,
    onAddReadme,
    params,
    progress,
    setDst,
    setSrc,
    src,
    workflow,
    workflowsConfig,
  } = state
  const classes = useStyles()

  const [editorElement, setEditorElement] = React.useState<HTMLDivElement | null>(null)
  const { height: metaHeight = 0 } = useResizeObserver({ ref: editorElement })
  const dialogContentClasses = Layout.useContentStyles({ metaHeight })

  const successor = React.useMemo(() => workflows.bucketToSuccessor(dst.bucket), [dst])

  const handleSubmit = React.useCallback(
    (event) => {
      event.preventDefault()
      create()
    },
    [create],
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
            </Layout.LeftColumn>
            <Layout.RightColumn>
              <Inputs.Files
                formStatus={formStatus}
                schema={entriesSchema}
                state={files}
                progress={progress}
                delayHashing={delayHashing}
                bucket={src?.bucket || dst.bucket}
              />
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

        {formStatus._tag === 'error' && !!formStatus.error && (
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

interface PackageCreationDialogUIOptions {
  resetFiles?: React.ReactNode
  submit?: React.ReactNode
  successBrowse?: React.ReactNode
  successRenderMessage?: (props: DialogSuccessRenderMessageProps) => React.ReactNode
  successTitle?: React.ReactNode
  title?: React.ReactNode
}

interface RenderDialogProps {
  close: () => void
  currentBucketCanBeSuccessor: boolean
  delayHashing: boolean
  disableStateDisplay: boolean
  dialogStatus: PDModel.DialogStatus
  formState: PDModel.State
  ui: PackageCreationDialogUIOptions
}

function RenderDialog({
  close,
  currentBucketCanBeSuccessor,
  delayHashing,
  disableStateDisplay,
  dialogStatus,
  formState,
  ui,
}: RenderDialogProps) {
  switch (dialogStatus._tag) {
    case 'loading':
      return (
        <DialogLoading
          skeletonElement={<FormSkeleton />}
          title={
            dialogStatus.waitListing
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
          error={dialogStatus.error}
          skeletonElement={<FormSkeleton animate={false} />}
          title={ui.title || 'Create package'}
          submitText={ui.submit}
          onCancel={close}
        />
      )
    case 'success':
      return (
        <DialogSuccess
          name={dialogStatus.name}
          hash={dialogStatus.hash}
          bucket={dialogStatus.bucket}
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
          delayHashing={delayHashing}
          disableStateDisplay={disableStateDisplay}
          state={formState}
          ui={ui}
        />
      )
    default:
      assertNever(dialogStatus)
  }
}

interface UseCreateDialogOptions {
  currentBucketCanBeSuccessor?: boolean
  delayHashing?: boolean
  disableStateDisplay?: boolean
  dst: PDModel.PackageDst
  src?: PDModel.PackageSrc
  open?: boolean | PDModel.FilesState['value']['added']
}

/**
 * Main package creation/editing form hook.
 *
 * Opens the primary form for creating new packages and editing existing ones.
 * Includes file panel for managing package contents.
 */
export default function useCreateDialog({
  disableStateDisplay = false,
  delayHashing = false,
  currentBucketCanBeSuccessor = false,
  dst: initialDst,
  src: initialSrc,
  open: initialOpen,
}: UseCreateDialogOptions) {
  const state = PDModel.useState(initialDst, initialSrc, initialOpen)
  const { formStatus, setDst, reset, workflowsConfig, open: isOpen, setOpen } = state

  const [exited, setExited] = React.useState(true)

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

      if (initial?.selection) {
        setWaitingListing(true)

        const handles = Selection.toHandlesList(initial?.selection)
        const filesMap = await getFiles(handles)
        setOpen(filesMap)

        setWaitingListing(false)
      }
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

  const dialogStatus: PDModel.DialogStatus = React.useMemo(() => {
    if (formStatus._tag === 'success') return { _tag: 'success', ...formStatus.handle }
    if (waitingListing) return { _tag: 'loading', waitListing: true }
    if (workflowsConfig._tag === 'loading') return { _tag: 'loading', waitListing: false }
    if (workflowsConfig._tag === 'error')
      return { _tag: 'error', error: workflowsConfig.error }
    return { _tag: 'ready' }
  }, [waitingListing, workflowsConfig, formStatus])

  const render = (ui: PackageCreationDialogUIOptions = {}) => (
    <DialogWrapper
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
          close={close}
          currentBucketCanBeSuccessor={currentBucketCanBeSuccessor}
          disableStateDisplay={disableStateDisplay}
          delayHashing={delayHashing}
          dialogStatus={dialogStatus}
          formState={state}
          ui={ui}
        />
      )}
    </DialogWrapper>
  )

  return { open, close, render }
}
