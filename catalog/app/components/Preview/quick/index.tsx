import * as React from 'react'
import * as M from '@material-ui/core'

import * as FileEditor from 'components/FileEditor'
import type * as Model from 'model'
import assertNever from 'utils/assertNever'

import * as Markdown from './Markdown'

function NoValue() {
  return <M.Typography>There is no content for quick preview</M.Typography>
}

function NoPreview() {
  return <M.Typography>Quick preview is not available for this type</M.Typography>
}

interface HandledMarkdown {
  tag: 'markdown'
}

interface HandledNone {
  tag: 'none'
}

type HandledType = HandledNone | HandledMarkdown // Json | Yaml

function convertToTypeUnion(type: FileEditor.EditorInputType | null): HandledType {
  if (!type) return { tag: 'none' }
  switch (type.brace) {
    case 'markdown':
      return { tag: 'markdown' }
    default:
      return { tag: 'none' }
  }
}

export function isQuickPreviewAvailable(type: FileEditor.EditorInputType | null) {
  return convertToTypeUnion(type).tag !== 'none'
}

interface TextPreviewProps {
  handle: Model.S3.S3ObjectLocation
  type: FileEditor.EditorInputType
  value?: string
}

export function QuickPreview({ handle, type, value }: TextPreviewProps) {
  if (!value) return <NoValue />

  const previewType = convertToTypeUnion(type)

  switch (previewType.tag) {
    case 'markdown':
      return <Markdown.Render value={value} handle={handle} />
    case 'none':
      return <NoPreview />
    default:
      assertNever(previewType)
  }
}
