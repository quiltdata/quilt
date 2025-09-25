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
import * as PD from './PackageDialog'
import * as State from './State'
import { FormSkeleton } from './Skeleton'
import SubmitSpinner from './SubmitSpinner'
// import { useUploads } from './Uploads'

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
    workflow,
    workflowsConfig,
  } = State.useContext()
  const classes = useStyles()

  const [editorElement, setEditorElement] = React.useState<HTMLDivElement | null>(null)
  const { height: metaHeight = 0 } = useResizeObserver({ ref: editorElement })
  const dialogContentClasses = PD.useContentStyles({ metaHeight })

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
  close: () => void
}

function RenderDialog({
  currentBucketCanBeSuccessor,
  disableStateDisplay,
  state,
  ui,
  close,
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
  } = State.useContext()

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
          close={close}
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
