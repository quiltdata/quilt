import * as Papa from 'papaparse'
import * as R from 'ramda'
import * as React from 'react'

import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import { useLogicalKeyResolver } from 'utils/LogicalKeyResolver'
import type * as LogicalKeyResolver from 'utils/LogicalKeyResolver'
import * as Resource from 'utils/Resource'
import hljs, { loadLanguages } from 'utils/hljs'
import * as s3paths from 'utils/s3paths'
import type { JsonRecord } from 'utils/types'

import { PreviewData, PreviewError } from '../types'

import FileType from './fileType'
import useGate from './useGate'
import * as utils from './utils'

export const FILE_TYPE = FileType.ECharts

export const detect = R.F

export const hasEChartsDatasource = (json?: JsonRecord) =>
  !!json?.dataset || Array.isArray(json?.series)

const hl = (language: string) => (contents: string) =>
  hljs.highlight(contents, { language }).value

async function resolvePath(
  path: string,
  handle: LogicalKeyResolver.S3SummarizeHandle,
  resolveLogicalKey: LogicalKeyResolver.LogicalKeyResolver | null,
) {
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

function useDatasetResolver(handle: LogicalKeyResolver.S3SummarizeHandle) {
  const resolveLogicalKey = useLogicalKeyResolver()
  return React.useMemo(
    () =>
      R.pipe(
        Resource.parse,
        Resource.Pointer.case({
          Web: async (url: string) => url,
          S3: async (h: $TSFixMe) => h,
          S3Rel: (path: string) => resolvePath(path, handle, resolveLogicalKey),
          Path: (path: string) => resolvePath(path, handle, resolveLogicalKey),
        }),
      ),
    [handle, resolveLogicalKey],
  )
}

async function downloadDatasetFromS3(s3: $TSFixMe, handle: $TSFixMe) {
  const loadedDatasetResponse = await utils.getObject({ s3, handle })
  return loadedDatasetResponse.Body.toString('utf-8')
}

async function downloadDatasetFromWeb(url: string) {
  const loadedDatasetResponse = await window.fetch(url)
  return loadedDatasetResponse.text()
}

const isSupportedSourceFormat = utils.extIn(['.tsv', '.csv'])

function useDataSetLoader() {
  // TODO: use utils.useObjectGetter
  const s3 = AWS.S3.use()
  return React.useCallback(
    async (handle: $TSFixMe) => {
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

interface EChartsLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  gated: boolean
  handle: LogicalKeyResolver.S3SummarizeHandle
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

function EChartsLoader({ gated, handle, children }: EChartsLoaderProps) {
  const { result, fetch } = utils.usePreview({
    type: 'txt',
    handle,
  } as $TSFixMe)

  // TODO: use useSignObjectUrls (and rename it),
  //       but besides signing also fetch resources
  const resolveDatasetUrl = useDatasetResolver(handle)
  const loadDataset = useDataSetLoader() // TODO: pass gated

  const processed = utils.useAsyncProcessing(
    result,
    async ({ info: { data, note, warnings } }: PreviewResult) => {
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
          if (
            option?.dataset.some(
              (dataset: $TSFixMe) => typeof dataset.source === 'string',
            )
          ) {
            throw new Error('Multiple remote sources are not supported')
          }
        }
        return PreviewData.ECharts({
          option,
          modes: [FileType.Json, FileType.ECharts, FileType.Text],
        })
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e)
        if (e instanceof SyntaxError) {
          const lang = 'json'
          await loadLanguages([lang])
          const highlighted = R.map(hl(lang), { head, tail } as $TSFixMe)
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

interface LoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: LogicalKeyResolver.S3SummarizeHandle
}

export const Loader = function GatedEChartsLoader({ handle, children }: LoaderProps) {
  const data = useGate(handle)
  const handled = utils.useErrorHandling(data.result, { handle, retry: data.fetch })
  return AsyncResult.case({
    _: children,
    Ok: (gated: boolean) => <EChartsLoader {...{ gated, handle, children }} />,
  })(handled)
}
