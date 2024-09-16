import * as React from 'react'

import * as PreviewUtils from 'components/Preview/loaders/utils'
import PreviewDisplay from 'components/Preview/Display'
import type * as Model from 'model'
import AsyncResult from 'utils/AsyncResult'

import Skeleton from './Skeleton'
import { EditorState } from './State'
import TextEditor from './TextEditor'
import QuiltConfigEditor from './QuiltConfigEditor'
import { loadMode } from './loader'
import { EditorInputType } from './types'

export { detect, isSupportedFileType } from './loader'

interface EditorProps extends EditorState {
  className: string
  editing: EditorInputType
  empty?: boolean
  handle: Model.S3.S3ObjectLocation
}

function EditorSuspended({
  className,
  editing,
  empty,
  error,
  handle,
  onChange,
  saving,
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
        disabled={disabled}
        error={error}
        handle={handle}
        initialValue=""
        onChange={onChange}
      />
    ) : (
      <TextEditor
        className={className}
        error={error}
        type={editing}
        initialValue=""
        onChange={onChange}
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
            disabled={disabled}
            error={error}
            handle={handle}
            initialValue={value}
            onChange={onChange}
          />
        )
      }
      return (
        <TextEditor
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

export function Editor(props: EditorProps) {
  return (
    <React.Suspense fallback={<Skeleton />}>
      <EditorSuspended {...props} />
    </React.Suspense>
  )
}
