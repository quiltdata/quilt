import * as R from 'ramda'

import AsyncResult from 'utils/AsyncResult'

import { PreviewData } from '../types'
import * as utils from './utils'

export const detect = R.pipe(utils.stripCompression, utils.extIs('.vcf'))

export const load = utils.previewFetcher(
  'vcf',
  R.pipe(
    ({
      info: {
        data: { meta, header, data },
        metadata: { variants },
        note,
        warnings,
      },
    }) => ({ meta, header, data, variants, note, warnings }),
    PreviewData.Vcf,
    AsyncResult.Ok,
  ),
)
