import { Box } from '@material-ui/core'
import { styled } from '@material-ui/styles'

import offset from 'utils/bgOffset'

import overlay2 from './overlay2.png'

export default styled(Box)({
  backgroundImage: `url(${overlay2})`,
  backgroundPosition: `top left ${offset(0)}`,
  backgroundSize: 'cover',
  height: 1105,
  left: 0,
  mixBlendMode: 'overlay',
  position: 'absolute',
  right: 0,
})
