import { SUPPORTED_EXTENSIONS } from 'components/Thumbnail'
import AsyncResult from 'utils/AsyncResult'

import { PreviewData } from '../types'

import * as utils from './utils'

export const detect = utils.extIn(SUPPORTED_EXTENSIONS)

export const Loader = function ImageLoader({ handle, children }) {
  return children(AsyncResult.Ok(PreviewData.Image({ handle })))
}
