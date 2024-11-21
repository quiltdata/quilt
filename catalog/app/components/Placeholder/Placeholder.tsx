import * as React from 'react'
import * as M from '@material-ui/core'

interface PlaceholderProps extends M.BoxProps {
  delay?: number
}

export default function Placeholder({ delay = 1000, ...props }: PlaceholderProps) {
  return (
    <M.Box
      alignItems="center"
      display="flex"
      justifyContent="center"
      minHeight="20rem"
      color="common.white"
      {...props}
    >
      <M.Fade in style={{ transitionDelay: `${delay}ms` }}>
        <M.CircularProgress size={120} color="inherit" />
      </M.Fade>
    </M.Box>
  )
}
