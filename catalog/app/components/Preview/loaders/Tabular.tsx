import * as R from 'ramda'
import * as React from 'react'

import { HTTPError } from 'utils/APIConnector'
import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import * as Data from 'utils/Data'
import mkSearch from 'utils/mkSearch'
import type { S3HandleBase } from 'utils/s3paths'

import { CONTEXT, PreviewData } from '../types'

import * as Parquet from './Parquet'
import * as utils from './utils'

const isCsv = utils.extIs('.csv')

const isExcel = utils.extIn(['.xls', '.xlsx'])

const isJsonl = utils.extIs('.jsonl')

const isParquet = R.anyPass([
  utils.extIn(['.parquet', '.pq']),
  R.test(/.+_0$/),
  R.test(/[.-]c\d{3,5}$/gi),
])

const isTsv = utils.extIs('.tsv')

export const detect: (key: string) => boolean = R.pipe(
  utils.stripCompression,
  R.anyPass([isCsv, isExcel, isJsonl, isParquet, isTsv]),
)

type TabularType = 'csv' | 'jsonl' | 'excel' | 'parquet' | 'tsv' | 'txt'

const detectTabularType: (type: string) => TabularType = R.pipe(
  utils.stripCompression,
  R.cond([
    [isCsv, R.always('csv')],
    [isExcel, R.always('excel')],
    [isJsonl, R.always('jsonl')],
    [isParquet, R.always('parquet')],
    [isTsv, R.always('tsv')],
    [R.T, R.always('txt')],
  ]),
)

function getQuiltInfo(headers: Headers): { truncated: boolean } | null {
  try {
    const header = headers.get('x-quilt-info')
    return header ? JSON.parse(header) : null
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    return null
  }
}

function getContentLength(headers: Headers): number | null {
  try {
    const header = headers.get('content-length')
    return header ? Number(header) : null
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    return null
  }
}

async function getCsvFromResponse(r: Response): Promise<ArrayBuffer | string> {
  const isArrow = r.headers.get('content-type') === 'application/vnd.apache.arrow.file'
  return isArrow ? r.arrayBuffer() : r.text()
}

interface LoadTabularDataArgs {
  compression?: 'gz' | 'bz2'
  endpoint: string
  handle: S3HandleBase
  sign: (h: S3HandleBase) => string
  type: TabularType
  size: 'small' | 'medium' | 'large'
}

interface TabularDataOutput {
  csv: ArrayBuffer | string
  size: number | null
  truncated: boolean
}

const loadTabularData = async ({
  compression,
  endpoint,
  size,
  handle,
  sign,
  type,
}: LoadTabularDataArgs): Promise<TabularDataOutput> => {
  const url = sign(handle)
  const r = await fetch(
    `${endpoint}/tabular-preview${mkSearch({
      compression,
      input: type,
      size,
      url,
    })}`,
  )
  try {
    if (r.status >= 400) {
      throw new HTTPError(r)
    }

    const csv = await getCsvFromResponse(r)

    const quiltInfo = getQuiltInfo(r.headers)
    const contentLength = getContentLength(r.headers)

    return {
      csv,
      size: contentLength,
      truncated: !!quiltInfo?.truncated,
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Error loading tabular preview', e)
    // eslint-disable-next-line no-console
    console.error(e)
    throw e
  }
}

function getNeededSize(context: string, gated: boolean) {
  switch (context) {
    case CONTEXT.FILE:
      return gated ? 'medium' : 'large'
    case CONTEXT.LISTING:
      return gated ? 'small' : 'large'
    // no default
  }
}

interface TabularLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: S3HandleBase
  options: { context: string } // TODO: restrict type
}

export const Loader = function TabularLoader({
  handle,
  children,
  options,
}: TabularLoaderProps) {
  const [gated, setGated] = React.useState(true)
  const endpoint = Config.use().binaryApiGatewayEndpoint
  const sign = AWS.Signer.useS3Signer()
  const type = React.useMemo(() => detectTabularType(handle.key), [handle.key])
  const onLoadMore = React.useCallback(() => setGated(false), [setGated])
  const size = React.useMemo(
    () => getNeededSize(options.context, gated),
    [options.context, gated],
  )

  const parquetMeta = Parquet.useParquet(
    { handle, query: { max_bytes: 0 } },
    { noAutoFetch: !isParquet(handle.key) },
  )

  const compression = utils.getCompression(handle.key)
  const data = Data.use(loadTabularData, {
    compression,
    endpoint,
    size,
    handle,
    sign,
    type,
  })
  // TODO: get correct sises from API
  const processed = utils.useProcessing(
    data.result,
    ({ csv, truncated }: TabularDataOutput) =>
      PreviewData.Perspective({
        context: options.context,
        data: csv,
        handle,
        onLoadMore: truncated && size !== 'large' ? onLoadMore : null,
        truncated,
        parquetMeta,
      }),
  )
  return children(utils.useErrorHandling(processed, { handle, retry: data.fetch }))
}
