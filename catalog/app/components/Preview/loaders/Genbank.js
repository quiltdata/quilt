import * as R from 'ramda'

import { PreviewData } from '../types'
import * as utils from './utils'

export const detect = R.pipe(utils.stripCompression, utils.extIs('.gb'))

export const Loader = function GenbankLoader({ handle, children }) {
  const data = utils.usePreview({ type: 'gb', handle })
  const processed = utils.useProcessing(data.result, (json) =>
    PreviewData.Genbank({
      src: json.info.data,
    }),
  )
  return children(utils.useErrorHandling(processed, { handle, retry: data.fetch }))
}
