import * as React from 'react'

import * as FileEditor from 'components/FileEditor'
import type * as Model from 'model'

import * as Markdown from './Markdown'

// TODO: Better error message
function NoValue() {
  return <h1>No value</h1>
}

// TODO: Better empty message
function NoPreview() {
  return <h1>No preview</h1>
}

export interface TextPreviewProps {
  handle: Model.S3.S3ObjectLocation
  type: FileEditor.EditorInputType
  value?: string
}

export default function TextPreview({ handle, type, value }: TextPreviewProps) {
  if (!value) return <NoValue />

  switch (type.brace) {
    case 'markdown':
      return <Markdown.Render contents={value} handle={handle} />
    default:
      return <NoPreview />
  }
}
