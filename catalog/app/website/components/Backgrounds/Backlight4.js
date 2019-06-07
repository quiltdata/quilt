import { Box } from '@material-ui/core'
import { styled } from '@material-ui/styles'

import backlight4 from './backlight1.png'

export default styled(Box)({
  backgroundImage: `url(${backlight4})`,
  backgroundPosition: 'center',
  backgroundSize: 'cover',
  height: 1449, // TODO
  left: 0,
  position: 'absolute',
  right: 0,
})
