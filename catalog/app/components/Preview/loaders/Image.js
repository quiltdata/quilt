import AsyncResult from 'utils/AsyncResult'

import { PreviewData } from '../types'

import * as utils from './utils'

export const detect = utils.extIn(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'])

export const load = (handle, callback) =>
  callback(AsyncResult.Ok(AsyncResult.Ok(PreviewData.Image({ handle }))))
