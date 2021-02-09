import * as React from 'react'
import * as M from '@material-ui/core'

import Delay from 'utils/Delay'

interface PlaceholderProps extends M.BoxProps {
  delay?: number
}

export default function Placeholder({ delay, ...props }: PlaceholderProps) {
  return (
    <M.Box
      alignItems="center"
      display="flex"
      justifyContent="center"
      minHeight="20rem"
      color="common.white"
      {...props}
    >
      <Delay ms={delay}>{() => <M.CircularProgress size={120} color="inherit" />}</Delay>
    </M.Box>
  )
}
