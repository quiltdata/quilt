import hljs from 'highlight.js'
import * as R from 'ramda'
import * as React from 'react'

import type * as Model from 'model'
import AsyncResult from 'utils/AsyncResult'

import { PreviewData, PreviewError } from '../types'

import * as Text from './Text'
import * as utils from './utils'

export const detect = R.startsWith('.quilt/packages/')

const hl = (language: string) => (contents: string) =>
  hljs.highlight(contents, { language }).value

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

interface LoaderProps {
  gated: boolean
  children: (result: $TSFixMe) => React.ReactNode
  handle: Model.S3.S3ObjectLocation
}

export const Loader = function ManifestLoader({ gated, handle, children }: LoaderProps) {
  const { result, fetch } = utils.usePreview({
    type: 'txt',
    handle,
    query: { max_bytes: Text.MAX_BYTES },
  })
  const processed = utils.useProcessing(
    result,
    ({ info: { data, note, warnings } }: PreviewResult) => {
      try {
        const [meta, ...entries] = [...data.head, ...data.tail]
        const packageMeta = meta ? JSON.parse(meta) : {}
        const packageEntries = R.map(
          R.pipe(
            JSON.parse,
            R.evolve({
              hash: R.prop('value'),
              meta: JSON.stringify,
              physical_keys: R.join(', '),
            }),
          ),
          entries,
        )
        return PreviewData.Perspective({ packageMeta, data: packageEntries })
      } catch (e) {
        if (e instanceof SyntaxError) {
          const head = data.head.join('\n')
          const tail = data.tail.join('\n')
          const lang = 'json'
          // @ts-expect-error ts can't find appropriate type declaration
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
