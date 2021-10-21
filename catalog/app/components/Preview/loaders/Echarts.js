import * as R from 'ramda'
import * as React from 'react'
import hljs from 'highlight.js'
import * as Papa from 'papaparse'

import * as AWS from 'utils/AWS'
import * as s3paths from 'utils/s3paths'

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

  const s3 = AWS.S3.use()

  const processed = utils.useAsyncProcessing(
    result,
    async ({ info: { data, note, warnings } }) => {
      const head = data.head.join('\n')
      const tail = data.tail.join('\n')
      try {
        const dataset = JSON.parse([head, tail].join('\n'))
        if (dataset.dataset && dataset.dataset.source) {
          const loadedDataset = await s3
            .getObject({
              Bucket: handle.bucket,
              Key: s3paths.resolveKey(handle.key, dataset.dataset.source),
              VersionId: handle.version,
            })
            .promise()
          if (dataset.dataset.source.endsWith('.csv')) {
            const json = Papa.parse(loadedDataset.Body.toString('utf-8'))
            dataset.dataset.source = json.data
          } else {
            dataset.dataset.source = JSON.parse(loadedDataset.Body.toString('utf-8'))
          }
        }
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
