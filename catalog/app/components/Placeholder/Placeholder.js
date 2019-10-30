import * as React from 'react'
import { Box, CircularProgress } from '@material-ui/core'

import Delay from 'utils/Delay'

export default ({ delay, ...props }) => (
  <Box
    alignItems="center"
    display="flex"
    justifyContent="center"
    minHeight="20rem"
    color="common.white"
    {...props}
  >
    <Delay ms={delay}>{() => <CircularProgress size={120} color="inherit" />}</Delay>
  </Box>
)
