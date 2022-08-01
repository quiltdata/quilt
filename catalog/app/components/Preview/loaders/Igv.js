import hljs from 'highlight.js'
import * as R from 'ramda'

import AsyncResult from 'utils/AsyncResult'

import { PreviewData, PreviewError } from '../types'

import * as summarize from './summarize'
import * as utils from './utils'

export const detect = (key, options) => summarize.detect('igv')(options)

const hl = (language) => (contents) => hljs.highlight(contents, { language }).value

export const Loader = function IgvLoader({ gated, handle, children }) {
  const { result, fetch } = utils.usePreview({
    type: 'txt',
    handle,
  })

  const processed = utils.useAsyncProcessing(
    result,
    async ({ info: { data, note, warnings } }) => {
      const head = data.head.join('\n')
      const tail = data.tail.join('\n')
      try {
        // TODO: url signers, re-use useVegaSpecSigner
        const options = JSON.parse([head, tail].join('\n'))
        return PreviewData.Igv({ options })
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e)
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
