import * as React from 'react'
import * as M from '@material-ui/core'
import { styled } from '@material-ui/styles'

import img2x from 'utils/img2x'

import plusPrimary from './plus-primary.png'
import plusPrimary2x from './plus-primary@2x.png'
import plusSecondary from './plus-secondary.png'
import plusSecondary2x from './plus-secondary@2x.png'
import plusTertiary from './plus-tertiary.png'
import plusTertiary2x from './plus-tertiary@2x.png'

const images = {
  primary: img2x(plusPrimary, plusPrimary2x),
  secondary: img2x(plusSecondary, plusSecondary2x),
  tertiary: img2x(plusTertiary, plusTertiary2x),
}

export default styled(({ variant, component = 'a', ...props }) => (
  <M.Box height={72} width={72} p={0} component={component} {...props} />
))(({ variant }) => ({
  backgroundColor: 'transparent',
  backgroundImage: `url(${images[variant]})`,
  backgroundSize: 'cover',
  border: 'none',
  borderRadius: '50%',
  boxShadow: {
    primary: [
      '0px -18px 32px 0px rgba(242, 168, 150, 0.12)',
      '0px 0px 24px 0px rgba(22, 32, 60, 0.16)',
    ],
    secondary: [
      '0px -18px 32px 0px rgba(92, 127, 234, 0.12)',
      '0px 0px 24px 0px rgba(22, 32, 60, 0.16)',
    ],
    tertiary: [
      '0px -18px 32px 0px rgba(163, 210, 214, 0.12)',
      '0px 0px 24px 0px rgba(22, 32, 60, 0.16)',
    ],
  }[variant],
  cursor: 'pointer',
  outline: 'none',
}))
