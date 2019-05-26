import { unstable_Box as Box } from '@material-ui/core/Box'
import { styled } from '@material-ui/styles'

import dots from './dots.png'

export default styled(Box)({
  backgroundImage: `url(${dots})`,
  backgroundRepeat: 'repeat',
  backgroundSize: 101,
  height: 1790,
  left: 0,
  mixBlendMode: 'overlay',
  position: 'absolute',
  right: 0,
})
