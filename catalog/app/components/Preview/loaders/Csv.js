import * as R from 'ramda'

import AsyncResult from 'utils/AsyncResult'

import { PreviewData } from '../types'
import * as utils from './utils'

export const detect = R.pipe(
  utils.stripCompression,
  utils.extIn(['.csv', '.tsv']),
)

const fetcher = utils.previewFetcher('csv', (json) =>
  AsyncResult.Ok(PreviewData.DataFrame({ preview: json.html })),
)

const isTsv = utils.extIs('.tsv')

export const load = (handle, callback) =>
  fetcher(handle, callback, isTsv(handle.key) ? { query: { sep: '\t' } } : undefined)
