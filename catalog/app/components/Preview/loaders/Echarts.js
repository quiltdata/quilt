import * as R from 'ramda'
import * as React from 'react'
import hljs from 'highlight.js'
import * as Papa from 'papaparse'

import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as s3paths from 'utils/s3paths'

import { PreviewData, PreviewError } from '../types'
import * as utils from './utils'

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
        const option = JSON.parse([head, tail].join('\n'))
        const source = option?.dataset?.source
        if (source && typeof source === 'string') {
          const loadedDatasetResponse = await s3
            .getObject({
              Bucket: handle.bucket,
              Key: s3paths.resolveKey(handle.key, source),
              VersionId: handle.version,
            })
            .promise()
          const loadedDataset = loadedDatasetResponse.Body.toString('utf-8')
          if (source.endsWith('.csv')) {
            option.dataset.source = Papa.parse(loadedDataset).data
          } else {
            option.dataset.source = JSON.parse(loadedDataset)
          }
        }
        return PreviewData.ECharts({ dataset: option })
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
  const data = utils.useGate(handle)
  const handled = utils.useErrorHandling(data.result, { handle, retry: data.fetch })
  return AsyncResult.case({
    _: children,
    Ok: (gated) => <EChartsLoader {...{ gated, handle, children }} />,
  })(handled)
}
