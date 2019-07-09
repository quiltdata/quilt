import * as R from 'ramda'

import AsyncResult from 'utils/AsyncResult'

import { PreviewData } from '../types'
import * as utils from './utils'

export const detect = R.pipe(
  utils.stripCompression,
  utils.extIs('.ipynb'),
)

export const load = utils.previewFetcher('ipynb', (json) =>
  AsyncResult.Ok(PreviewData.Notebook({ preview: json.html })),
)
