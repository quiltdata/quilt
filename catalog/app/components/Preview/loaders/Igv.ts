import hljs from 'highlight.js'
import * as R from 'ramda'
import * as React from 'react'

import AsyncResult from 'utils/AsyncResult'
import { S3SummarizeHandle } from 'utils/LogicalKeyResolver'
import type { JsonRecord } from 'utils/types'

import { PreviewData, PreviewError } from '../types'

import useSignObjectUrls from './useSignObjectUrls'
import FileType from './fileType'
import * as utils from './utils'

export const FILE_TYPE = FileType.Igv

const traverseUrls = (fn: (v: any) => any, json: JsonRecord) =>
  R.evolve(
    {
      reference: R.evolve({
        fastaURL: fn,
        indexURL: fn,
        compressedIndexURL: fn,
        cytobandURL: fn,
        aliasURL: fn,
      }),
      tracks: R.map(
        R.evolve({
          url: fn,
          indexURL: fn,
        }),
      ),
    },
    json,
  )

export const detect = R.F

export const hasIgvTracks = (json?: JsonRecord) => Array.isArray(json?.tracks)

const hl = (language: string) => (contents: string) =>
  hljs.highlight(contents, { language }).value

interface IgvLoaderProps {
  children: (r: $TSFixMe) => React.ReactNode
  gated?: boolean
  handle: S3SummarizeHandle
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
  const signUrls = useSignObjectUrls(handle, traverseUrls, { asyncReady: true })

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
        const options = JSON.parse([head, tail].join('\n'))
        if (!options.reference?.indexFile && options.reference?.fastaURL) {
          // This is a copy of the IGV behaviour, that is a copy IGV desktop behaviour.
          // But with a fix of a bug when after signing URLs `fastaURL` contains async thunk.
          // `indexFile` will be discarded if reference has `indexURL`
          // XXX: remove that after https://github.com/igvteam/igv.js/pull/1821 merged
          options.reference.indexFile = `${options.reference.fastaURL}.fai`
        }
        const auxOptions = await signUrls(options)
        return PreviewData.Igv({
          options: auxOptions,
          modes: [FileType.Igv, FileType.Json, FileType.Text],
        })
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
