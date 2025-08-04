import * as redux from 'react-redux'

import { authenticated as authenticatedSelector } from 'containers/Auth/selectors'
import cfg from 'constants/config'

export default function useIsEnabled() {
  const authenticated = redux.useSelector(authenticatedSelector)
  return cfg.qurator && authenticated
}
