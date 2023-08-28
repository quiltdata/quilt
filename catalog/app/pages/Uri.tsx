import * as R from 'ramda'
import * as React from 'react'

import Placeholder from 'components/Placeholder'
import requireAuth from 'containers/Auth/wrapper'
import cfg from 'constants/config'
import * as RT from 'utils/reactTools'

const protect = cfg.alwaysRequiresAuth ? requireAuth() : R.identity

export const Component: React.FC = protect(
  RT.mkLazy(() => import('containers/UriResolver'), Placeholder),
)
