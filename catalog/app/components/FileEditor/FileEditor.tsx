import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import PreviewDisplay from 'components/Preview/Display'
import * as PreviewUtils from 'components/Preview/loaders/utils'
import { QuickPreview } from 'components/Preview/quick'
import type * as Model from 'model'
import AsyncResult from 'utils/AsyncResult'

import Skeleton from './Skeleton'
import { EditorState } from './State'
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
  saving: disabled,
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

export function Editor(props: EditorProps) {
  const classes = useStyles()
  return (
    <React.Suspense fallback={<Skeleton />}>
      <div className={cx(classes.tab, { [classes.active]: !props.preview })}>
        <EditorSuspended {...props} />
      </div>
      {props.preview && (
        <div className={cx(classes.tab, classes.active)}>
          <QuickPreview handle={props.handle} type={props.editing} value={props.value} />
        </div>
      )}
    </React.Suspense>
  )
}
