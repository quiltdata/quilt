import * as React from 'react'
import { Typography, TypographyProps } from '@material-ui/core'
import { styled } from '@material-ui/core/styles'

import styledBy from 'utils/styledBy'

type BulletColor = 'primary' | 'secondary' | 'tertiary'

const bulletColors: Record<BulletColor, { shadow: string; gradient: string }> = {
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

interface BulletProps extends Omit<TypographyProps, 'color'> {
  color: BulletColor
  dense?: boolean
}

export default styled(({ color, dense, ...props }: BulletProps) => (
  <Typography variant="body1" color="textSecondary" {...props} />
))({
  lineHeight: styledBy('dense', (d: boolean = false) => (d ? 1.5 : 2)),
  marginBottom: styledBy('dense', (d: boolean = false) => (d ? '1em' : '2em')),
  paddingLeft: 32,
  position: 'relative',

  '&::before': {
    backgroundImage: styledBy(
      'color',
      (c: BulletColor) => `linear-gradient(to top, ${bulletColors[c].gradient})`,
    ),
    borderRadius: '50%',
    boxShadow: styledBy('color', (c: BulletColor) => [
      [0, 0, 16, 0, bulletColors[c].shadow],
    ]),
    content: '""',
    display: 'inline-flex',
    height: 8,
    position: 'absolute',
    top: styledBy('dense', (d: boolean = false) => (d ? 8 : 12)),
    left: 0,
    width: 8,
  },
})
