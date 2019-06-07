import { Box } from '@material-ui/core'
import { styled } from '@material-ui/styles'

import backlight3 from './backlight1.png'

export default styled(Box)({
  backgroundImage: `url(${backlight3})`,
  backgroundPosition: 'center',
  backgroundSize: 'cover',
  height: 1449, // TODO
  left: 0,
  position: 'absolute',
  right: 0,
})
