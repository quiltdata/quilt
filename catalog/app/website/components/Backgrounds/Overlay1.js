import { unstable_Box as Box } from '@material-ui/core/Box'
import { styled } from '@material-ui/styles'

import overlay1 from './overlay1.png'

export default styled(Box)({
  backgroundImage: `url(${overlay1})`,
  backgroundPosition: 'center',
  backgroundSize: 'cover',
  height: 741,
  left: 0,
  mixBlendMode: 'overlay',
  position: 'absolute',
  right: 0,
})
