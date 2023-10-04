import * as React from 'react'

import Placeholder from 'components/Placeholder'
import * as RT from 'utils/reactTools'

import type { IgvProps } from './Igv'

const SuspensePlaceholder = () => <Placeholder color="text.secondary" />

const Igv = RT.mkLazy(() => import('./Igv'), SuspensePlaceholder)

export default (data: IgvProps, props: IgvProps) => <Igv {...data} {...props} />
