import * as Papa from 'papaparse'
import * as R from 'ramda'
import * as React from 'react'

import { HTTPError } from 'utils/APIConnector'
import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import * as Data from 'utils/Data'
import { mkSearch } from 'utils/NamedRoutes'

import * as Excel from './Excel'
import * as Fcs from './Fcs'
import * as Parquet from './Parquet'
import * as Vcf from './Vcf'
import { PreviewData } from '../types'
import * as utils from './utils'

export const MAX_BYTES = 10 * 1024

export const detect = R.anyPass([
  Excel.detect,
  Fcs.detect,
  Parquet.detect,
  Vcf.detect,
  R.pipe(utils.stripCompression, utils.extIn(['.csv', '.tsv'])),
])

// TODO: ['ipynb', 'bed']
const detectTabularType = R.cond([
  [Excel.detect, R.always('excel')],
  [Fcs.detect, R.always('fcs')],
  [Parquet.detect, R.always('parquet')],
  [Vcf.detect, R.always('vcf')],
  [R.pipe(utils.stripCompression, utils.extIn(['.csv', '.tsv'])), R.always('csv')],
  [R.T, R.always('txt')],
])

// [[...row1], [...row2]] → { a: [...rowA], b: [...rowB]}
function makeHeadedTable(parsed) {
  return parsed.reduce((memo, row, index) => {
    if (index === 0) {
      return row.reduce((memoHead, title) => {
        memoHead[title] = []
        return memoHead
      }, memo)
    }

    return row.reduce((memoCells, value, cellIndex) => {
      const title = parsed[0][cellIndex]
      memoCells[title].push(value)
      return memoCells
    }, memo)
  }, {})
}

const loadTabularData = async ({ endpoint, handle, sign, type }) => {
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
    console.warn('Error loading tabular preview', { ...e })
    // eslint-disable-next-line no-console
    console.error(e)
    throw e
  }
}

export const Loader = function TabularLoader({ handle, children }) {
  const endpoint = Config.use().binaryApiGatewayEndpoint
  const sign = AWS.Signer.useS3Signer()
  const type = React.useMemo(() => detectTabularType(handle.key), [handle.key])
  const data = Data.use(loadTabularData, { endpoint, handle, sign, type })
  const processed = utils.useProcessing(data.result, (csv) =>
    PreviewData.Perspective({
      data: makeHeadedTable(Papa.parse(csv).data),
    }),
  )
  return children(utils.useErrorHandling(processed, { handle, retry: data.fetch }))
}
