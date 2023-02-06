import * as React from 'react'

import PreviewDisplay from 'components/Preview/Display'
import * as PreviewUtils from 'components/Preview/loaders/utils'
import FileType from 'components/Preview/loaders/fileType'
import AsyncResult from 'utils/AsyncResult'
import * as RT from 'utils/reactTools'
import type { S3HandleBase } from 'utils/s3paths'

import type { EditorState } from './State'
import Skeleton from './Skeleton'
import { EditorInputType } from './types'

import type { ExcelEditorProps } from './ExcelEditor'
import type { QuiltConfigEditorProps } from './QuiltConfigEditor'
import type { TextEditorProps } from './TextEditor'

const ExcelEditor: React.FC<ExcelEditorProps> = RT.mkLazy(
  () => import('./ExcelEditor'),
  Skeleton,
)
const QuiltConfigEditor: React.FC<QuiltConfigEditorProps> = RT.mkLazy(
  () => import('./QuiltConfigEditor'),
  Skeleton,
)
const TextEditor: React.FC<TextEditorProps> = RT.mkLazy(
  () => import('./TextEditor'),
  Skeleton,
)

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
    switch (editing.type) {
      case FileType.Tabular:
        return (
          <ExcelEditor
            disabled={disabled}
            error={error}
            handle={handle}
            initialValue=""
            onChange={onChange}
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
      switch (editing.type) {
        case FileType.Tabular:
          return (
            <ExcelEditor
              disabled={disabled}
              error={error}
              handle={handle}
              initialValue={response.Body}
              onChange={onChange}
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
