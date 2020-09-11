import AsyncResult from 'utils/AsyncResult'

import { PreviewError } from '../types'

export const detect = () => true

export const Loader = function FallbackLoader({ handle, children }) {
  return children(AsyncResult.Err(PreviewError.Unsupported({ handle })))
}
