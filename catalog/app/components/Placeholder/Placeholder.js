import * as React from 'react'
import { Box, CircularProgress } from '@material-ui/core'

import Delay from 'utils/Delay'

export default () => (
  <Box
    alignItems="center"
    display="flex"
    justifyContent="center"
    minHeight="20rem"
    color="common.white"
  >
    <Delay>{() => <CircularProgress size={120} color="inherit" />}</Delay>
  </Box>
)
