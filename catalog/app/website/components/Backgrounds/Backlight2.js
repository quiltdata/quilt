import { Box } from '@material-ui/core'
import { styled } from '@material-ui/styles'

import backlight2 from './backlight2.png'

export default styled(Box)({
  backgroundImage: `url(${backlight2})`,
  backgroundPosition: 'center',
  backgroundSize: 'cover',
  height: 1872,
  left: 0,
  position: 'absolute',
  right: 0,
})
