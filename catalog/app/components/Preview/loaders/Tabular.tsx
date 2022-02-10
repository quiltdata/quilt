import * as R from 'ramda'
import * as React from 'react'

import { HTTPError } from 'utils/APIConnector'
import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import * as Data from 'utils/Data'
import { mkSearch } from 'utils/NamedRoutes'
import type { S3HandleBase } from 'utils/s3paths'

import { PreviewData } from '../types'

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

interface LoadTabularDataArgs {
  endpoint: string
  handle: S3HandleBase
  sign: (h: S3HandleBase) => string
  type: TabularType
  gated: boolean
}

const loadTabularData = async ({
  endpoint,
  gated,
  handle,
  sign,
  type,
}: LoadTabularDataArgs) => {
  const url = sign(handle)
  const r = await fetch(
    `${endpoint}/tabular-preview${mkSearch({
      url,
      input: type,
      size: gated ? 'small' : 'large',
    })}`,
  )
  try {
    const text = await r.text()

    const quiltInfo = JSON.parse(r.headers.get('x-quilt-info') || '{}')

    if (r.status >= 400) {
      throw new HTTPError(r, text)
    }
    return {
      csv: text,
      truncated: quiltInfo.truncated,
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Error loading tabular preview', e)
    // eslint-disable-next-line no-console
    console.error(e)
    throw e
  }
}

interface TabularLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: S3HandleBase
  // options: { context: string } // TODO: restrict type
}

export const Loader = function TabularLoader({
  handle,
  children,
}: // options,
TabularLoaderProps) {
  // TODO: load 'small' on listing, and 'medium' on file
  const [gated, setGated] = React.useState(true)
  const endpoint = Config.use().binaryApiGatewayEndpoint
  const sign = AWS.Signer.useS3Signer()
  const type = React.useMemo(() => detectTabularType(handle.key), [handle.key])
  const onLoadMore = React.useCallback(() => setGated(false), [setGated])
  const data = Data.use(loadTabularData, { endpoint, gated, handle, sign, type })
  const processed = utils.useProcessing(
    data.result,
    ({ csv, truncated }: { csv: string; truncated: boolean }) =>
      PreviewData.Perspective({
        data: csv,
        onLoadMore: truncated ? onLoadMore : null,
      }),
  )
  return children(utils.useErrorHandling(processed, { handle, retry: data.fetch }))
}
