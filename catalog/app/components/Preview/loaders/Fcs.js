import * as R from 'ramda'

import AsyncResult from 'utils/AsyncResult'

import { PreviewData } from '../types'
import * as utils from './utils'

export const detect = R.pipe(utils.stripCompression, utils.extIs('.fcs'))

export const load = utils.previewFetcher(
  'fcs',
  R.pipe(
    ({ html, info }) => ({
      preview: html,
      metadata: info.metadata,
      note: info.note,
      warnings: info.warnings,
    }),
    PreviewData.Fcs,
    AsyncResult.Ok,
  ),
)
