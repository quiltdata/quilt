import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import {
  TextPreviewProps,
  Skeleton as TextPreviewSkeleton,
} from 'components/Preview/text'
import * as PreviewUtils from 'components/Preview/loaders/utils'
import PreviewDisplay from 'components/Preview/Display'
import type * as Model from 'model'
import AsyncResult from 'utils/AsyncResult'
import * as RT from 'utils/reactTools'

import Skeleton from './Skeleton'
import { EditorState } from './State'
import TextEditor from './TextEditor'
import QuiltConfigEditor from './QuiltConfigEditor'
import { loadMode } from './loader'
import { EditorInputType } from './types'

export { detect, isSupportedFileType } from './loader'

const TextPreview: React.FC<TextPreviewProps> = RT.mkLazy(
  () => import('components/Preview/text'),
  TextPreviewSkeleton,
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
  empty,
  error,
  handle,
  onChange,
  editing,
}: EditorProps) {
  const disabled = saving
  if (editing.brace !== '__quiltConfig') {
    loadMode(editing.brace || 'plain_text') // TODO: loaders#typeText.brace
  }

  const data = PreviewUtils.useObjectGetter(handle, { noAutoFetch: empty })
  if (empty)
    return editing.brace === '__quiltConfig' ? (
      <QuiltConfigEditor
        className={className}
        handle={handle}
        disabled={disabled}
        error={error}
        onChange={onChange}
        initialValue=""
      />
    ) : (
      <TextEditor
        autoFocus
        className={className}
        error={error}
        initialValue=""
        onChange={onChange}
        type={editing}
      />
    )
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
      if (editing.brace === '__quiltConfig') {
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
      }
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
          <TextPreview type={props.editing} value={props.value} />
        </div>
      )}
    </React.Suspense>
  )
}
