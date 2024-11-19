import * as React from 'react'

import * as FileEditor from 'components/FileEditor'
import type * as Model from 'model'
import assertNever from 'utils/assertNever'

import * as Markdown from './Markdown'

// TODO: Better error message
function NoValue() {
  return <h1>No value</h1>
}

// TODO: Better empty message
function NoPreview() {
  return <h1>No preview</h1>
}

interface TextPreviewProps {
  handle: Model.S3.S3ObjectLocation
  type: FileEditor.EditorInputType
  value?: string
}

export function isPreviewAvailable(type: FileEditor.EditorInputType | null) {
  return type?.brace === 'markdown'
}

export default function TextPreview({ handle, type, value }: TextPreviewProps) {
  if (!value) return <NoValue />

  if (type?.brace !== 'markdown') return <NoPreview />

  switch (type.brace) {
    case 'markdown':
      return <Markdown.Render value={value} handle={handle} />
    default:
      assertNever(type.brace)
  }
}
