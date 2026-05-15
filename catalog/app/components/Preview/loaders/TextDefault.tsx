// Always-on fallback text loader: when no other registered loader claims a
// file, render it as plain text via the preview lambda. The preview lambda
// detects binary content and returns a structured error envelope
// ({ info: { error: 'binary', detected } }); when that arrives we render a
// clear "binary file" message instead of dumping bytes.
import { basename } from 'path'

import hljs from 'highlight.js'
import * as R from 'ramda'
import * as React from 'react'

import { PreviewData, PreviewError } from '../types'

import FileType from './fileType'
import * as utils from './utils'

export const MAX_BYTES = 10 * 1024

export const FILE_TYPE = FileType.Text

// Always match. This loader runs after every other loader in the chain
// (between Text and fallback) so it only fires for genuinely unknown
// extensions.
export const detect = () => true

interface BinaryEnvelope {
  info: {
    error: 'binary'
    detected?: string
  }
  html: ''
}

interface TextEnvelope {
  info: {
    data: { head: string[]; tail: string[] }
    note?: string
    warnings?: string
  }
  html: string
}

type PreviewEnvelope = BinaryEnvelope | TextEnvelope

const isBinaryEnvelope = (r: PreviewEnvelope): r is BinaryEnvelope =>
  Boolean((r as BinaryEnvelope)?.info?.error === 'binary')

const hl = (language: string) => (contents: string) =>
  hljs.highlight(contents, { language }).value

interface Handle {
  key: string
  logicalKey?: string
}

interface LoaderProps {
  handle: Handle
  children: (result: unknown) => React.ReactNode
}

export const Loader = function TextDefaultLoader({ handle, children }: LoaderProps) {
  const { result, fetch } = utils.usePreview({
    type: 'txt',
    handle,
    query: { max_bytes: MAX_BYTES },
  })
  const processed = utils.useProcessing(
    result,
    (response: PreviewEnvelope) => {
      if (isBinaryEnvelope(response)) {
        const detected = response.info.detected ? ` (${response.info.detected})` : ''
        throw PreviewError.Unsupported({
          handle,
          // PreviewError.Unsupported is rendered generically, but pass the
          // detected hint via message in case the renderer surfaces it.
          message: `Binary file${detected} — no text preview available`,
        } as $TSFixMe)
      }
      const data = (response as TextEnvelope).info.data
      const head = data.head.join('\n')
      const tail = (data.tail || []).join('\n')
      const lang = (() => {
        const name = R.pipe(R.unary(basename), R.toLower)(handle.logicalKey || handle.key)
        return name.endsWith('.json') || name.endsWith('.jsonl') ? 'json' : 'plaintext'
      })()
      const highlighted = { head: hl(lang)(head), tail: hl(lang)(tail) }
      return PreviewData.Text({
        head,
        tail,
        lang,
        highlighted,
        note: (response as TextEnvelope).info.note,
        warnings: (response as TextEnvelope).info.warnings,
      })
    },
    [handle.logicalKey, handle.key],
  )
  return <>{children(utils.useErrorHandling(processed, { handle, retry: fetch }))}</>
}

export default {
  detect,
  FILE_TYPE,
  Loader,
}
