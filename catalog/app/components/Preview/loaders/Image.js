import { SUPPORTED_EXTENSIONS } from 'components/Thumbnail'
import AsyncResult from 'utils/AsyncResult'

import { PreviewData } from '../types'

import * as utils from './utils'

export const detect = utils.extIn(SUPPORTED_EXTENSIONS)

// TODO: issue a head request to ensure existance and get storage class
export const Loader = function ImageLoader({ handle, children }) {
  return children(AsyncResult.Ok(PreviewData.Image({ handle })))
}
