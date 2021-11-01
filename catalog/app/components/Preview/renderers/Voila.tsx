import * as R from 'ramda'

import Iframe from './IFrame'

const DEFAULT_IFRAME_HEIGHT = '1024px'

export default (
  ifr: React.HTMLProps<HTMLIFrameElement>,
  props: React.HTMLProps<HTMLIFrameElement>,
) => {
  const heightLens = R.lensPath(['style', 'height'])
  const defaultHeight = R.defaultTo(DEFAULT_IFRAME_HEIGHT)
  return Iframe(ifr, R.over(heightLens, defaultHeight, props))
}
