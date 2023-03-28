import * as React from 'react'

import * as PreviewUtils from 'components/Preview/loaders/utils'
import PreviewDisplay from 'components/Preview/Display'
import * as Model from 'model'
import AsyncResult from 'utils/AsyncResult'

import Skeleton from './Skeleton'
import { EditorState } from './State'
import TextEditor from './TextEditor'
import QuiltConfigEditor from './QuiltConfigEditor'
import { loadMode } from './loader'
import { EditorInputType } from './types'

export { detect, isSupportedFileType } from './loader'

interface EditorProps extends EditorState {
  editing: EditorInputType
  empty?: boolean
  handle: Model.S3.S3ObjectLocation
}

function EditorSuspended({
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
        handle={handle}
        disabled={disabled}
        error={error}
        onChange={onChange}
        initialValue=""
      />
    ) : (
      <TextEditor error={error} type={editing} value="" onChange={onChange} />
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
          disabled={disabled}
          error={error}
          onChange={onChange}
          type={editing}
          value={value}
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
