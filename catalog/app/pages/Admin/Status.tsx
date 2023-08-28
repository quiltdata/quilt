import * as React from 'react'

import Placeholder from 'components/Placeholder'
import * as RT from 'utils/reactTools'

import { authenticatedOnly } from '../utils'

export const Component: React.FC = authenticatedOnly(
  RT.mkLazy(() => import('containers/Admin/Status'), Placeholder),
)
