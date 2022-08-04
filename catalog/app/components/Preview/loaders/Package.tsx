import hljs from 'highlight.js'
import * as R from 'ramda'
import * as React from 'react'

import AsyncResult from 'utils/AsyncResult'
import type { S3HandleBase } from 'utils/s3paths'
import { JsonRecord } from 'utils/types'

import { PreviewData, PreviewError } from '../types'

import * as Text from './Text'
import * as utils from './utils'

export const detect = R.startsWith('.quilt/')

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
  handle: S3HandleBase
}

interface PackageMeta {
  version?: string
  workflow?: string
  message?: string
}

interface PackageEntry {
  logical_key: string
  physical_keys: string[]
  size: number
  hash: {
    type: string
    value: string
  }
  meta: JsonRecord
}

const parseMeta = (obj: string): PackageMeta => JSON.parse(obj)

const parseEntries = (obj: string): PackageEntry[] => JSON.parse(obj)

export const Loader = function PackageLoader({ gated, handle, children }: LoaderProps) {
  const { result, fetch } = utils.usePreview({
    type: 'txt',
    handle,
    query: { max_bytes: Text.MAX_BYTES },
  })
  const processed = utils.useProcessing(
    result,
    ({ info: { data, note, warnings } }: PreviewResult) => {
      try {
        const dataList = [...data.head, ...data.tail]
        const packageMeta = dataList[0] ? parseMeta(dataList[0]) : {}
        const packageEntries = R.pipe(
          R.tail,
          R.join(',\n'),
          (x) => `[${x}]`,
          parseEntries,
          R.map(
            R.evolve({
              hash: R.prop('value'),
              meta: JSON.stringify,
              physical_keys: R.join(', '),
            }),
          ),
        )(dataList)
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
