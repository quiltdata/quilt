import { SUPPORTED_EXTENSIONS } from 'components/Thumbnail'
import AsyncResult from 'utils/AsyncResult'

import { PreviewData } from '../types'

import * as utils from './utils'

export const detect = utils.extIn(SUPPORTED_EXTENSIONS)

export const load = (handle, callback) =>
  callback(AsyncResult.Ok(AsyncResult.Ok(PreviewData.Image({ handle }))))
