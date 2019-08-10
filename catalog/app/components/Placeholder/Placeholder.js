import * as React from 'react'
import { Box, CircularProgress } from '@material-ui/core'

import Delay from 'utils/Delay'

export default () => (
  <Box alignItems="center" display="flex" justifyContent="center" minHeight="20rem">
    <Delay>{() => <CircularProgress size={120} />}</Delay>
  </Box>
)
