import hljs from 'highlight.js'
import * as R from 'ramda'
import * as React from 'react'

import AsyncResult from 'utils/AsyncResult'
import type { S3HandleBase } from 'utils/s3paths'
import type { JsonRecord } from 'utils/types'

import { PreviewData, PreviewError } from '../types'

import * as ECharts from './ECharts'
import * as Igv from './Igv'
import * as Text from './Text'
import * as Vega from './Vega'
import FileType from './fileType'
import * as summarize from './summarize'
import * as utils from './utils'

const MAX_SIZE = 20 * 1024 * 1024
const BYTES_TO_SCAN = 128 * 1024

export const FILE_TYPE = FileType.Json

const hl =
  (language: string) =>
  (contents: string): string =>
    hljs.highlight(contents, { language }).value

function guessAvailableModes(json: JsonRecord, jsonStr: string) {
  if (Vega.detectSchema(jsonStr)) return [FileType.Vega, FileType.Json, FileType.Text]
  if (Igv.hasIgvTracks(json)) return [FileType.Json, FileType.Igv, FileType.Text]
  if (ECharts.hasEChartsDatasource(json))
    return [FileType.Json, FileType.ECharts, FileType.Text]
  return [FileType.Json, FileType.Text]
}

interface JsonLoaderProps {
  gated: boolean
  handle: S3HandleBase
  children: (result: $TSFixMe) => React.ReactNode
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

function JsonLoader({ gated, handle, children }: JsonLoaderProps) {
  const { result, fetch } = utils.usePreview({
    type: 'txt',
    handle,
    query: { max_bytes: Text.MAX_BYTES },
  })
  const processed = utils.useProcessing(
    result,
    ({ info: { data, note, warnings } }: PreviewResult) => {
      const head = data.head.join('\n')
      const tail = data.tail.join('\n')
      const str = [head, tail].join('\n')
      try {
        const rendered = JSON.parse(str)
        return PreviewData.Json({ rendered, modes: guessAvailableModes(rendered, str) })
      } catch (e) {
        if (e instanceof SyntaxError) {
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
  return (
    <>
      {children(
        gated && AsyncResult.Init.is(handled)
          ? AsyncResult.Err(PreviewError.Gated({ handle, load: fetch }))
          : handled,
      )}
    </>
  )
}

export const detect = utils.extIs('.json')

interface LoaderOptions extends summarize.FileExtended {
  mode?: FileType
}

function findLoader(firstBytes: string, options: LoaderOptions) {
  if (options.mode || options.types) {
    // User already choose this loader
    return JsonLoader
  }
  return Vega.detectSchema(firstBytes) ? Vega.Loader : JsonLoader
}

interface LoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: S3HandleBase
  options: LoaderOptions
}

export const Loader = function GatedJsonLoader({
  handle,
  children,
  options,
}: LoaderProps) {
  return utils.useFirstBytes({ bytes: BYTES_TO_SCAN, handle }).case({
    Ok: ({
      firstBytes,
      contentLength,
    }: {
      firstBytes: string
      contentLength: number
    }) => {
      const LoaderComponent = findLoader(firstBytes, options)
      return (
        <LoaderComponent {...{ handle, children, gated: contentLength > MAX_SIZE }} />
      )
    },
    _: children,
  })
}
