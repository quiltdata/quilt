import * as R from 'ramda'

import AsyncResult from 'utils/AsyncResult'

import { PreviewData } from '../types'
import * as utils from './utils'

export const detect = R.pipe(
  utils.stripCompression,
  utils.extIn(['.csv', '.tsv']),
)

export const load = utils.previewFetcher('csv', (json) =>
  AsyncResult.Ok(PreviewData.DataFrame({ preview: json.html })),
)
