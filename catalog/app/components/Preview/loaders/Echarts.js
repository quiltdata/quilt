import * as React from 'react'
import hljs from 'highlight.js'

import { PreviewData, PreviewError } from '../types'
import * as utils from './utils'

const MAX_SIZE = 20 * 1024 * 1024
const BYTES_TO_SCAN = 128 * 1024

export const detect = (key, options) => options?.types?.includes('echarts')

const hl = (language) => (contents) => hljs.highlight(contents, { language }).value

function EChartsLoader({ gated, handle, children }) {
  const { result, fetch } = utils.usePreview({
    type: 'txt',
    handle,
  })
  const processed = utils.useProcessing(
    result,
    ({ info: { data, note, warnings } }) => {
      const head = data.head.join('\n')
      const tail = data.tail.join('\n')
      try {
        const dataset = JSON.parse([head, tail].join('\n'))
        return PreviewData.ECharts({ dataset })
      } catch (e) {
        if (e instanceof SyntaxError) {
          const lang = 'json'
          const highlighted = R.map(hl(lang), { head, tail })
          return PreviewData.Text({
            head,
            tail,
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

export const Loader = function GatedEchartsLoader({ handle, children }) {
  //  TODO: utils.useGate(handle)
  return utils.useFirstBytes({ bytes: BYTES_TO_SCAN, handle }).case({
    Ok: ({ contentLength }) => (
      <EChartsLoader {...{ handle, children, gated: contentLength > MAX_SIZE }} />
    ),
    _: children,
  })
}
