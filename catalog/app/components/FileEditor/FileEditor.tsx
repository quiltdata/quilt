import * as React from 'react'

import * as PreviewUtils from 'components/Preview/loaders/utils'
import PreviewDisplay from 'components/Preview/Display'
import AsyncResult from 'utils/AsyncResult'
import type { S3HandleBase } from 'utils/s3paths'

import type { EditorState } from './State'
import ExcelEditor from './ExcelEditor'
import QuiltConfigEditor from './QuiltConfigEditor'
import Skeleton from './Skeleton'
import TextEditor from './TextEditor'
import { EditorInputType } from './types'

export { detect, isSupportedFileType } from './loader'

interface EditorProps extends EditorState {
  editing: EditorInputType
  empty?: boolean
  handle: S3HandleBase
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
  const data = PreviewUtils.useObjectGetter(handle, { noAutoFetch: empty })
  if (empty)
    switch (editing.brace) {
      case 'less':
        return (
          <ExcelEditor
            disabled={disabled}
            error={error}
            onChange={onChange}
            initialValue=""
          />
        )
      case '__quiltConfig':
        return (
          <QuiltConfigEditor
            handle={handle}
            disabled={disabled}
            error={error}
            onChange={onChange}
            initialValue=""
          />
        )
      default:
        return <TextEditor error={error} type={editing} value="" onChange={onChange} />
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
        case 'less':
          return (
            <ExcelEditor
              disabled={disabled}
              error={error}
              onChange={onChange}
              initialValue={response.Body}
            />
          )
        case '__quiltConfig':
          return (
            <QuiltConfigEditor
              handle={handle}
              disabled={disabled}
              error={error}
              onChange={onChange}
              initialValue={value}
            />
          )
        default:
          return (
            <TextEditor
              disabled={disabled}
              error={error}
              onChange={onChange}
              type={editing}
              value={value}
            />
          )
      }
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
