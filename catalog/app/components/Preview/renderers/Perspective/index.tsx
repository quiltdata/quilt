import * as React from 'react'

import Placeholder from 'components/Placeholder'
import * as RT from 'utils/reactTools'

import { PerspectiveProps } from './types'

const SuspensePlaceholder = () => <Placeholder color="text.secondary" />

const Perspective = RT.mkLazy(() => import('./Perspective'), SuspensePlaceholder)

export default (data: PerspectiveProps, props: PerspectiveProps) => (
  <Perspective {...data} {...props} />
)
