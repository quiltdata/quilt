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

interface EditorProps extends EditorState {
  className: string
  editing: EditorInputType
  empty?: boolean
  handle: Model.S3.S3ObjectLocation
}

function EditorSuspended({
  className,
  saving,
  empty,
  error,
  handle,
  onChange,
  editing,
}: EditorProps) {
  const disabled = saving
  if (editing.brace !== '__quiltConfig' && editing.brace !== '__quiltSummarize') {
    loadMode(editing.brace || 'plain_text') // TODO: loaders#typeText.brace
  }

  const data = PreviewUtils.useObjectGetter(handle, { noAutoFetch: empty })
  if (empty)
    switch (editing.brace) {
      case '__quiltConfig':
        return (
          <QuiltConfigEditor
            className={className}
            handle={handle}
            disabled={disabled}
            error={error}
            onChange={onChange}
            initialValue=""
          />
        )
      case '__quiltSummarize':
        return (
          <QuiltSummarize
            className={className}
            disabled={disabled}
            error={error}
            initialValue=""
            onChange={onChange}
          />
        )
      default:
        return (
          <TextEditor
            autoFocus
            className={className}
            error={error}
            initialValue=""
            onChange={onChange}
            type={editing}
          />
        )
    }
  return data.case({
    _: () => <Skeleton />,
    Err: (
      err: $TSFixMe, // PreviewError
    ) => (
      <div>
        {/* @ts-expect-error */}
        <PreviewDisplay data={AsyncResult.Err(err)} />
      </div>
    ),
    Ok: (response: { Body: Buffer }) => {
      const value = response.Body.toString('utf-8')
      switch (editing.brace) {
        case '__quiltConfig':
          return (
            <QuiltConfigEditor
              className={className}
              handle={handle}
              disabled={disabled}
              error={error}
              onChange={onChange}
              initialValue={value}
            />
          )
        case '__quiltSummarize':
          return (
            <QuiltSummarize
              className={className}
              disabled={disabled}
              error={error}
              initialValue={value}
              onChange={onChange}
            />
          )
        default:
          return (
            <TextEditor
              autoFocus
              className={className}
              disabled={disabled}
              error={error}
              onChange={onChange}
              type={editing}
              initialValue={value}
            />
          )
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
