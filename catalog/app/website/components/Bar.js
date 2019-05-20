import * as React from 'react'
import { styled } from '@material-ui/styles'
import { unstable_Box as Box } from '@material-ui/core/Box'

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
