import * as React from 'react'
import { Typography } from '@material-ui/core'
import { styled } from '@material-ui/styles'

import styledBy from 'utils/styledBy'

const bulletColors = {
  primary: {
    shadow: '#ffafaa',
    gradient: '#f1b39d, #f78881',
  },
  secondary: {
    shadow: '#6072e9',
    gradient: '#5c83ea, #6752e6',
  },
  tertiary: {
    shadow: '#a7d5d6',
    gradient: '#c2ead6, #3c85da',
  },
}

export default styled(({ color, dense, ...props }) => (
  <Typography variant="body1" color="textSecondary" {...props} />
))({
  lineHeight: styledBy('dense', (d = false) => (d ? 1.5 : 2)),
  marginBottom: styledBy('dense', (d = false) => (d ? '1em' : '2em')),
  paddingLeft: 32,
  position: 'relative',

  '&::before': {
    backgroundImage: styledBy(
      'color',
      (c) => `linear-gradient(to top, ${bulletColors[c].gradient})`,
    ),
    borderRadius: '50%',
    boxShadow: styledBy('color', (c) => [[0, 0, 16, 0, bulletColors[c].shadow]]),
    content: '""',
    display: 'inline-flex',
    height: 8,
    position: 'absolute',
    top: styledBy('dense', (d = false) => (d ? 8 : 12)),
    left: 0,
    width: 8,
  },
})
