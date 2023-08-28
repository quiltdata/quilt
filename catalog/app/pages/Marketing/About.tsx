import * as React from 'react'

import Placeholder from 'components/Placeholder'
import * as RT from 'utils/reactTools'

export const Component: React.FC = RT.mkLazy(
  () => import('website/pages/About'),
  Placeholder,
)
