import * as Papa from 'papaparse'
import * as R from 'ramda'

import { PreviewData } from '../types'
import * as utils from './utils'

export const MAX_BYTES = 10 * 1024

export const detect = R.pipe(utils.stripCompression, utils.extIn(['.csv', '.tsv']))

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

export const Loader = function CsvLoader({ handle, children }) {
  const asyncData = utils.usePreview({
    type: 'txt',
    handle,
    query: { max_bytes: MAX_BYTES },
  })
  const processed = utils.useProcessing(
    asyncData.result,
    ({ info: { data, note, warnings } }) => {
      const csv = data.head.join('\n')
      return PreviewData.Perspective({
        data: makeHeadedTable(Papa.parse(csv).data),
        note,
        warnings,
      })
    },
  )
  return children(utils.useErrorHandling(processed, { handle, retry: asyncData.fetch }))
}
