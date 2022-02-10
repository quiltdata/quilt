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
}

const loadTabularData = async ({ endpoint, handle, sign, type }: LoadTabularDataArgs) => {
  const url = sign(handle)
  const r = await fetch(`${endpoint}/tabular-preview${mkSearch({ url, input: type })}`)
  try {
    const text = await r.text()
    if (r.status >= 400) {
      throw new HTTPError(r, text)
    }
    return text
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
  // options: { context: typeof CONTEXT }
}

export const Loader = function TabularLoader({
  handle,
  children,
}: // options,
TabularLoaderProps) {
  const endpoint = Config.use().binaryApiGatewayEndpoint
  const sign = AWS.Signer.useS3Signer()
  const type = React.useMemo(() => detectTabularType(handle.key), [handle.key])
  const data = Data.use(loadTabularData, { endpoint, handle, sign, type })
  const processed = utils.useProcessing(data.result, (csv: string) =>
    PreviewData.Perspective({
      data: csv,
    }),
  )
  return children(utils.useErrorHandling(processed, { handle, retry: data.fetch }))
}
