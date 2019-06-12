import { Box } from '@material-ui/core'
import { styled } from '@material-ui/styles'

import backlight4 from './backlight4.png'

export default styled(Box)({
  backgroundImage: `url(${backlight4})`,
  backgroundPosition: 'center',
  backgroundSize: 'cover',
  height: 2059,
  left: 0,
  position: 'absolute',
  right: 0,
})
