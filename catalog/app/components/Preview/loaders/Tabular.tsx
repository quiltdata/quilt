import * as R from 'ramda'
import * as React from 'react'

import { HTTPError } from 'utils/APIConnector'
import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import * as Data from 'utils/Data'
import { mkSearch } from 'utils/NamedRoutes'
import type { S3HandleBase } from 'utils/s3paths'

import * as requests from 'containers/Bucket/requests/requestsUntyped'

import { CONTEXT, PreviewData } from '../types'

import * as Csv from './Csv'
import * as Excel from './Excel'
import * as Fcs from './Fcs'
import * as Parquet from './Parquet'
import * as Vcf from './Vcf'
import * as utils from './utils'

// TODO
// const isBed = R.pipe(utils.stripCompression, utils.extIs('.bed'))

export const detect = R.anyPass([
  Csv.detect,
  Excel.detect,
  Fcs.detect,
  Parquet.detect,
  Vcf.detect,
  // isBed, // TODO
])

type TabularType = 'csv' | 'excel' | 'fcs' | 'parquet' | 'vcf' | 'txt'
// TODO: ['ipynb', 'bed']
const detectTabularType: (type: string) => TabularType = R.cond([
  [Csv.detect, R.always('csv')],
  [Excel.detect, R.always('excel')],
  [Fcs.detect, R.always('fcs')],
  [Parquet.detect, R.always('parquet')],
  [Vcf.detect, R.always('vcf')],
  // [isBed, R.always('bed')], // TODO
  [R.T, R.always('txt')],
])

function getQuiltInfo(r: Response): { truncated: boolean } | null {
  try {
    const header = r.headers.get('x-quilt-info')
    return header ? JSON.parse(header) : null
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    return null
  }
}

function getContentLength(r: Response): number | null {
  try {
    const header = r.headers.get('content-length')
    return header ? Number(header) : null
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    return null
  }
}

interface LoadTabularDataArgs {
  endpoint: string
  handle: S3HandleBase
  sign: (h: S3HandleBase) => string
  type: TabularType
  size: 'small' | 'medium' | 'large'
}

interface TabularDataOutput {
  csv: string
  truncated: boolean
  size: number | null
}

const loadTabularData = async ({
  endpoint,
  size,
  handle,
  sign,
  type,
}: LoadTabularDataArgs): Promise<TabularDataOutput> => {
  const url = sign(handle)
  const r = await fetch(
    `${endpoint}/tabular-preview${mkSearch({
      url,
      input: type,
      size,
    })}`,
  )
  try {
    const text = await r.text()

    if (r.status >= 400) {
      throw new HTTPError(r, text)
    }

    const quiltInfo = getQuiltInfo(r)
    const contentLength = getContentLength(r)

    return {
      csv: text,
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

function useContentLength(handle: S3HandleBase): number | null {
  const s3 = AWS.S3.use()
  const objExistsData = Data.use(requests.getObjectExistence, { s3, ...handle })
  return React.useMemo(
    () =>
      objExistsData.case({
        _: () => null,
        Ok: requests.ObjectExistence.case({
          Exists: (r: $TSFixMe) => r.size,
          _: () => null,
        }),
      }),
    [objExistsData],
  )
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
  const data = Data.use(loadTabularData, { endpoint, size, handle, sign, type })
  const fullSize = useContentLength(handle)
  const processed = utils.useProcessing(
    data.result,
    ({ csv, truncated, size: currentSize }: TabularDataOutput) =>
      PreviewData.Perspective({
        context: options.context,
        data: csv,
        handle,
        onLoadMore: truncated && size !== 'large' ? onLoadMore : null,
        truncated,
        size: {
          full: fullSize,
          current: currentSize,
        },
      }),
  )
  return children(utils.useErrorHandling(processed, { handle, retry: data.fetch }))
}
