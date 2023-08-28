import * as R from 'ramda'

import requireAuth from 'containers/Auth/wrapper'
import cfg from 'constants/config'

export const protect = cfg.alwaysRequiresAuth ? requireAuth() : R.identity

export const authenticatedOnly = protect
