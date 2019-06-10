import * as React from 'react'
import { Box } from '@material-ui/core'
import { styled } from '@material-ui/styles'

import img2x from 'utils/img2x'

export default styled(({ srcs, dir, offset, centerOffset, width, alwaysAbsolute, boxProps, ...props }) => (
  <Box position="relative" {...props} {...boxProps}>
    <img alt="" src={img2x(...srcs)} />
  </Box>
))(({ theme: t, dir = 'left', offset, centerOffset, width, alwaysAbsolute }) => ({
  '& img': {
    [alwaysAbsolute ? '&' : t.breakpoints.up('md')]: {
      position: 'absolute',
      [dir]: -offset,
      width,
    },
    [alwaysAbsolute ? '.__unused' : t.breakpoints.down('sm')]: {
      left: centerOffset,
      position: 'relative',
      width: '100%',
    },
  },
}))
