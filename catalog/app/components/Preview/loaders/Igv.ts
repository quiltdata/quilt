import hljs from 'highlight.js'
import * as R from 'ramda'

import AsyncResult from 'utils/AsyncResult'
import type { S3HandleBase } from 'utils/s3paths'

import { PreviewData, PreviewError } from '../types'

import * as summarize from './summarize'
import * as utils from './utils'

export const detect = (key: string, options: summarize.File) =>
  summarize.detect('igv')(options)

const hl = (language: string) => (contents: string) =>
  hljs.highlight(contents, { language }).value

interface IgvLoaderProps {
  children: (r: $TSFixMe) => React.ReactNode
  gated?: boolean
  handle: S3HandleBase
}

interface PreviewResult {
  info: {
    data: {
      head: string[]
      tail: string[]
    }
    note?: string
    warnings?: string
  }
}

export const Loader = function IgvLoader({ gated, handle, children }: IgvLoaderProps) {
  const { result, fetch } = utils.usePreview({
    type: 'txt',
    handle,
  } as $TSFixMe)

  const processed = utils.useAsyncProcessing(
    result,
    async ({ info: { data, note, warnings } }: PreviewResult) => {
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
          // @ts-expect-error ts can't find appropriate type declaration
          const highlighted = R.map<string, string>(hl(lang), { head, tail })
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
