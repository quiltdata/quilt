import * as R from 'ramda'

import { PreviewData } from '../types'
import * as utils from './utils'

export const detect = R.pipe(utils.stripCompression, utils.extIs('.vcf'))

export const Loader = function VcfLoader({ handle, children }) {
  const { result, fetch } = utils.usePreview({ type: 'vcf', handle })
  const processed = utils.useProcessing(
    result,
    ({
      info: {
        data: { meta, header, data },
        metadata: { variants },
        note,
        warnings,
      },
    }) => PreviewData.Vcf({ meta, header, data, variants, note, warnings }),
  )
  return children(utils.useErrorHandling(processed, { handle, retry: fetch }))
}
