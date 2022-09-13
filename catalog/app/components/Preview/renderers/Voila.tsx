import type * as React from 'react'
import * as R from 'ramda'

import Iframe from './IFrame'

const DEFAULT_IFRAME_HEIGHT = '1024px'

const assocDefaultHeight = R.over<{ style?: React.CSSProperties }, string | number>(
  R.lensPath(['style', 'height']),
  R.defaultTo(DEFAULT_IFRAME_HEIGHT),
)

export default (
  ifr: React.HTMLProps<HTMLIFrameElement>,
  props: React.HTMLProps<HTMLIFrameElement>,
) => Iframe(ifr, assocDefaultHeight(props))
