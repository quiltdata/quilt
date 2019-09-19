import { Box } from '@material-ui/core'
import { styled } from '@material-ui/styles'

import overlay1Full from './overlay1full.png'

export default styled(Box)({
  backgroundImage: `url(${overlay1Full})`,
  backgroundPosition: 'center',
  backgroundSize: 'cover',
  height: 754,
  left: 0,
  mixBlendMode: 'overlay',
  position: 'absolute',
  right: 0,
})
