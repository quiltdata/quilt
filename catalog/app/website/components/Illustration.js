import * as React from 'react'
import { styled } from '@material-ui/styles'
import { unstable_Box as Box } from '@material-ui/core/Box'

const img2x = (x1, x2) => (window.devicePixelRatio >= 1.5 ? x2 : x1)

export default styled(({ srcs, dir, offset, width, ...props }) => (
  <Box position="relative" {...props}>
    <img alt="" src={img2x(...srcs)} />
  </Box>
))(({ dir = 'left', offset, width }) => ({
  '& img': {
    position: 'absolute',
    [dir]: -offset,
    width,
  },
}))
