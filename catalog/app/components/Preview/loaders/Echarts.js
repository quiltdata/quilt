import hljs from 'highlight.js'
import * as Papa from 'papaparse'
import * as R from 'ramda'
import * as React from 'react'

import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import { useLogicalKeyResolver } from 'utils/LogicalKeyResolver'
import * as Resource from 'utils/Resource'
import * as s3paths from 'utils/s3paths'

import { PreviewData, PreviewError } from '../types'

import * as summarize from './summarize'
import * as utils from './utils'

export const detect = (key, options) => summarize.detect('echarts')(options)

const hl = (language) => (contents) => hljs.highlight(contents, { language }).value

async function resolvePath(path, handle, resolveLogicalKey) {
  const resolvedHandle = {
    bucket: handle.bucket,
    key: s3paths.resolveKey(handle.key, path),
  }

  if (!resolveLogicalKey || !handle.logicalKey) return resolvedHandle

  try {
    const resolvedLogicalHandle = await resolveLogicalKey(
      s3paths.resolveKey(handle.logicalKey, path),
    )
    return resolvedLogicalHandle
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Error resolving logical key', { handle, path })
    // eslint-disable-next-line no-console
    console.error(error)
    return {
      ...resolvedHandle,
      error,
    }
  }
}

function useDatasetResolver(handle) {
  const resolveLogicalKey = useLogicalKeyResolver()
  return React.useMemo(
    () =>
      R.pipe(
        Resource.parse,
        Resource.Pointer.case({
          Web: async (url) => url,
          S3: async (h) => h,
          S3Rel: (path) => resolvePath(path, handle, resolveLogicalKey),
          Path: (path) => resolvePath(path, handle, resolveLogicalKey),
        }),
      ),
    [handle, resolveLogicalKey],
  )
}

async function downloadDatasetFromS3(s3, handle) {
  const loadedDatasetResponse = await utils.getObject({ s3, handle })
  return loadedDatasetResponse.Body.toString('utf-8')
}

async function downloadDatasetFromWeb(url) {
  const loadedDatasetResponse = await window.fetch(url)
  return loadedDatasetResponse.text()
}

const isSupportedSourceFormat = utils.extIn(['.tsv', '.csv'])

function useDataSetLoader() {
  // TODO: use utils.useObjectGetter
  const s3 = AWS.S3.use()
  return React.useCallback(
    async (handle) => {
      const loadedDataset = await (typeof handle === 'string'
        ? downloadDatasetFromWeb(handle)
        : downloadDatasetFromS3(s3, handle))
      if (isSupportedSourceFormat(handle?.key || handle)) {
        return Papa.parse(loadedDataset).data
      } else {
        return JSON.parse(loadedDataset)
      }
    },
    [s3],
  )
}

function EChartsLoader({ gated, handle, children }) {
  const { result, fetch } = utils.usePreview({
    type: 'txt',
    handle,
  })

  const resolveDatasetUrl = useDatasetResolver(handle)
  const loadDataset = useDataSetLoader() // TODO: pass gated

  const processed = utils.useAsyncProcessing(
    result,
    async ({ info: { data, note, warnings } }) => {
      const head = data.head.join('\n')
      const tail = data.tail.join('\n')
      try {
        const option = JSON.parse([head, tail].join('\n'))
        const source = option?.dataset?.source
        if (source && typeof source === 'string') {
          const datasetHandle = await resolveDatasetUrl(source)
          option.dataset.source = await loadDataset(datasetHandle)
        }
        if (Array.isArray(option?.dataset)) {
          if (option?.dataset.some((dataset) => typeof dataset.source === 'string')) {
            throw new Error('Multiple remote sources are not supported')
          }
        }
        return PreviewData.ECharts({ option })
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

export const Loader = function GatedEchartsLoader({ handle, children }) {
  const data = utils.useGate(handle)
  const handled = utils.useErrorHandling(data.result, { handle, retry: data.fetch })
  return AsyncResult.case({
    _: children,
    Ok: (gated) => <EChartsLoader {...{ gated, handle, children }} />,
  })(handled)
}
