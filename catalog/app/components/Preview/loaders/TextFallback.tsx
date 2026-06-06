// Always-on fallback text loader: when no other registered loader claims a
// file, render it as plain text via the preview lambda. The preview lambda
// detects binary content and returns a structured error envelope
// ({ info: { error: 'binary', detected } }); when that arrives we render a
// clear "binary file" message instead of dumping bytes.
//
// IMPORTANT: this loader's position in the `loaderChain` in load.jsx is
// load-bearing. `detect = () => true` means it claims everything that
// reaches it, so it must run after every type-specific loader and
// immediately before the generic `fallback`. Re-ordering breaks the
// "specific loader wins" contract.
import * as React from 'react'

import { PreviewData, PreviewError } from '../types'

import FileType from './fileType'
import { getLang, hl } from './Text'
import * as utils from './utils'

export const MAX_BYTES = 10 * 1024

export const FILE_TYPE = FileType.Text

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

interface Handle {
  key: string
  logicalKey?: string
}

interface LoaderProps {
  handle: Handle
  children: (result: unknown) => React.ReactNode
}

export const Loader = function TextFallbackLoader({ handle, children }: LoaderProps) {
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
          message: `Binary file${detected} — no text preview available`,
        })
      }
      const textResponse = response as TextEnvelope
      if (!textResponse.info) {
        throw PreviewError.Unexpected({
          handle,
          retry: fetch,
          message: 'preview lambda returned an unexpected envelope (missing info)',
        })
      }
      const data = textResponse.info.data
      if (!data || !data.head) {
        throw PreviewError.Unexpected({
          handle,
          retry: fetch,
          message: 'preview lambda returned an unexpected envelope (missing info.data)',
        })
      }
      const head = data.head.join('\n')
      const tail = (data.tail || []).join('\n')
      const lang: string = getLang(handle.logicalKey || handle.key)
      const highlight = hl(lang)
      const highlighted = { head: highlight(head), tail: highlight(tail) }
      return PreviewData.Text({
        head,
        tail,
        lang,
        highlighted,
        note: textResponse.info.note,
        warnings: textResponse.info.warnings,
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
