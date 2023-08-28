import * as React from 'react'

import Placeholder from 'components/Placeholder'
import cfg from 'constants/config'
import * as RT from 'utils/reactTools'

import { authenticatedOnly } from './utils'

const Landing = RT.mkLazy(() => import('website/pages/Landing'), Placeholder)
const OpenLanding = RT.mkLazy(() => import('website/pages/OpenLanding'), Placeholder)

export const Component: React.FC = authenticatedOnly(
  cfg.mode === 'OPEN' ? OpenLanding : Landing,
)
