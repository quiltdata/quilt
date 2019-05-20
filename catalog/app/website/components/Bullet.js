import * as React from 'react'
import { Typography } from '@material-ui/core'
import { styled } from '@material-ui/styles'

const bulletColors = {
  primary: {
    shadow: '#ffafaa',
    gradient: ['#f1b39d', '#f78881'],
  },
  secondary: {
    shadow: '#6072e9',
    gradient: ['#5c83ea', '#6752e6'],
  },
  tertiary: {
    shadow: '#a7d5d6',
    gradient: ['#c2ead6', '#3c85da'],
  },
}

export default styled(({ color, ...props }) => (
  <Typography variant="body1" color="textSecondary" {...props} />
))(({ color }) => ({
  marginBottom: '2em',
  paddingLeft: 32,
  position: 'relative',

  '&::before': {
    backgroundImage: `linear-gradient(to top, ${bulletColors[color].gradient.join(
      ', ',
    )})`,
    borderRadius: '50%',
    boxShadow: [[0, 0, 16, 0, bulletColors[color].shadow]],
    content: '""',
    display: 'inline-flex',
    height: 8,
    position: 'absolute',
    top: 12,
    left: 0,
    width: 8,
  },
}))
