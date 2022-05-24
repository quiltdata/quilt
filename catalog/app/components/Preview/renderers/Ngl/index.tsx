import * as React from 'react'

import Placeholder from 'components/Placeholder'
import * as RT from 'utils/reactTools'

import type { NglProps } from './Ngl'

const SuspensePlaceholder = () => <Placeholder color="text.secondary" />

const Ngl = RT.mkLazy(() => import('./Ngl'), SuspensePlaceholder)

export default (data: NglProps, props: NglProps) => <Ngl {...data} {...props} />
