import * as React from 'react'
import { styled } from '@material-ui/styles'
import { Box } from '@material-ui/core'

export default styled(({ color, ...props }) => <Box {...props} />)(
  ({ theme: t, color }) => ({
    width: 40,
    height: 2,
    background: {
      primary: t.palette.primary.light,
      secondary: t.palette.secondary.main,
      tertiary: t.palette.tertiary.main,
    }[color],
  }),
)
