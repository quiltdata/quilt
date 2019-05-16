import * as R from 'ramda'

import AsyncResult from 'utils/AsyncResult'

import { PreviewData } from '../types'
import * as utils from './utils'

export const detect = R.pipe(
  utils.stripCompression,
  utils.extIn(['.xls', '.xlsx']),
)

export const load = utils.previewFetcher('excel', (json) =>
  AsyncResult.Ok(PreviewData.DataFrame({ preview: json.html })),
)
