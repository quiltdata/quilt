import { unstable_Box as Box } from '@material-ui/core/Box'
import { styled } from '@material-ui/styles'

import backlight2 from './backlight1.png'

export default styled(Box)({
  backgroundImage: `url(${backlight2})`,
  backgroundPosition: 'center',
  backgroundSize: 'cover',
  height: 1449, // TODO
  left: 0,
  position: 'absolute',
  right: 0,
})
