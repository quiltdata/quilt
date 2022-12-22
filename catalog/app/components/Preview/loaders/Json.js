import hljs from 'highlight.js'
import * as R from 'ramda'
import * as React from 'react'

import AsyncResult from 'utils/AsyncResult'

import { PreviewData, PreviewError } from '../types'

import * as Text from './Text'
import * as Vega from './Vega'
import * as utils from './utils'

const MAX_SIZE = 20 * 1024 * 1024
const BYTES_TO_SCAN = 128 * 1024

const hl = (language) => (contents) => hljs.highlight(contents, { language }).value

function JsonLoader({ gated, handle, children }) {
  const { result, fetch } = utils.usePreview({
    type: 'txt',
    handle,
    query: { max_bytes: Text.MAX_BYTES },
  })
  const processed = utils.useProcessing(
    result,
    ({ info: { data, note, warnings } }) => {
      const head = data.head.join('\n')
      const tail = data.tail.join('\n')
      try {
        const rendered = JSON.parse([head, tail].join('\n'))
        return PreviewData.Json({ rendered })
      } catch (e) {
        if (e instanceof SyntaxError) {
          const lang = 'json'
          const highlighted = R.map(hl(lang), { head, tail })
          return PreviewData.Text({
            lang,
            highlighted,
            note,
            warnings,
          })
        }
        throw e
      }
    },
    [],
  )
  const handled = utils.useErrorHandling(processed, { handle, retry: fetch })
  return children(
    gated && AsyncResult.Init.is(handled)
      ? AsyncResult.Err(PreviewError.Gated({ handle, load: fetch }))
      : handled,
  )
}

export const detect = utils.extIs('.json')

function findLoader(firstBytes) {
  return Vega.detectSchema(firstBytes) ? VegaLoader : JsonLoader
}

export const Loader = function GatedJsonLoader({ handle, children }) {
  return utils.useFirstBytes({ bytes: BYTES_TO_SCAN, handle }).case({
    Ok: ({ firstBytes, contentLength }) => {
      const LoaderComponent = findLoader(firstBytes)
      return (
        <LoaderComponent {...{ handle, children, gated: contentLength > MAX_SIZE }} />
      )
    },
    _: children,
  })
}
