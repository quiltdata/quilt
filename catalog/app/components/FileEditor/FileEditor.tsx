import cx from 'classnames'
import * as React from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import PreviewDisplay from 'components/Preview/Display'
import * as PreviewUtils from 'components/Preview/loaders/utils'
import { QuickPreview } from 'components/Preview/quick'
import type * as Model from 'model'
import AsyncResult from 'utils/AsyncResult'
import * as PackageLock from 'utils/PackageLock'

import Skeleton from './Skeleton'
import { Blocked, EditorState, LOCKED_OUT } from './State'
import TextEditor from './TextEditor'
import QuiltConfigEditor from './QuiltConfigEditor'
import { loadMode } from './loader'
import { EditorInputType } from './types'

export { detect, isSupportedFileType } from './loader'

const QuiltSummarize = React.lazy(() => import('./QuiltConfigEditor/QuiltSummarize'))
const BucketPreferences = React.lazy(
  () => import('./QuiltConfigEditor/BucketPreferences'),
)

interface EditorProps extends EditorState {
  className: string
  editing: EditorInputType
  empty?: boolean
  handle: Model.S3.S3ObjectLocation
}

function EditorSuspended({
  className,
  saving,
  writable,
  empty,
  error,
  handle,
  onChange,
  editing,
}: EditorProps) {
  if (
    editing.brace !== '__quiltConfig' &&
    editing.brace !== '__quiltSummarize' &&
    editing.brace !== '__bucketPreferences'
  ) {
    loadMode(editing.brace || 'plain_text') // TODO: loaders#typeText.brace
  }

  const data = PreviewUtils.useObjectGetter(handle, { noAutoFetch: empty })
  const disabled = saving || !writable
  const initialProps = {
    className,
    disabled,
    error,
    onChange,
    initialValue: '',
  }
  if (empty)
    switch (editing.brace) {
      case '__quiltConfig':
        return <QuiltConfigEditor {...initialProps} handle={handle} />
      case '__bucketPreferences':
        return <BucketPreferences {...initialProps} handle={handle} />
      case '__quiltSummarize':
        return <QuiltSummarize {...initialProps} />
      default:
        return <TextEditor {...initialProps} autoFocus type={editing} />
    }
  return data.case({
    _: () => <Skeleton />,
    Err: (
      err: $TSFixMe, // PreviewError
    ) => (
      <div>
        <PreviewDisplay data={AsyncResult.Err(err)} />
      </div>
    ),
    Ok: (response: { Body: Buffer }) => {
      const initialValue = response.Body.toString('utf-8')
      const props = {
        ...initialProps,
        initialValue,
      }
      switch (editing.brace) {
        case '__quiltConfig':
          return <QuiltConfigEditor {...props} handle={handle} />
        case '__bucketPreferences':
          return <BucketPreferences {...props} handle={handle} />
        case '__quiltSummarize':
          return <QuiltSummarize {...props} />
        default:
          return <TextEditor {...props} autoFocus type={editing} />
      }
    },
  })
}

const useStyles = M.makeStyles({
  tab: {
    display: 'none',
    width: '100%',
  },
  active: {
    display: 'block',
  },
})

function ModeFallback({ error }: { error: Error }) {
  return (
    <M.Typography variant="body2" color="error">
      Could not load the editor: {error.message}
    </M.Typography>
  )
}

export function Editor(props: EditorProps) {
  const classes = useStyles()
  return (
    // `loadMode` throws its failure rather than re-suspending, so without a boundary
    // here a missing syntax-mode chunk takes down the page around the editor.
    <ErrorBoundary FallbackComponent={ModeFallback}>
      {/* Here, not in the editors: config editors read `error` only on mount. */}
      {props.lockedOut && <Notice>{LOCKED_OUT}</Notice>}
      <React.Suspense fallback={<Skeleton />}>
        <div className={cx(classes.tab, { [classes.active]: !props.preview })}>
          <EditorSuspended {...props} />
        </div>
        {props.preview && (
          <div className={cx(classes.tab, classes.active)}>
            <QuickPreview
              handle={props.handle}
              type={props.editing}
              value={props.value}
            />
          </div>
        )}
      </React.Suspense>
    </ErrorBoundary>
  )
}

function Notice({ children }: React.PropsWithChildren<{}>) {
  return (
    <Lab.Alert role="status" severity="info" icon={<M.Icon>lock</M.Icon>}>
      {children}
    </Lab.Alert>
  )
}

const BLOCKED = {
  locked: `${PackageLock.reason('locked')}; it can't be edited until an admin unlocks it.`,
  invalid: "This file can't be edited: the link doesn't name a file in a package.",
  forbidden: 'Editing files is turned off for this bucket.',
}

// In place of an editor the URL asked for that can't open.
export function Requested({ requested }: { requested: Blocked }) {
  if (requested === 'loading') return <Skeleton />
  return <Notice>{BLOCKED[requested]}</Notice>
}
