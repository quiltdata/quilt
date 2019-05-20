import * as React from 'react'
import { styled } from '@material-ui/styles'

import plusPrimary from './plus-primary.png'
import plusPrimary2x from './plus-primary@2x.png'
import plusSecondary from './plus-secondary.png'
import plusSecondary2x from './plus-secondary@2x.png'
import plusTertiary from './plus-tertiary.png'
import plusTertiary2x from './plus-tertiary@2x.png'

const img2x = (x1, x2) => (window.devicePixelRatio >= 1.5 ? x2 : x1)

const images = {
  primary: img2x(plusPrimary, plusPrimary2x),
  secondary: img2x(plusSecondary, plusSecondary2x),
  tertiary: img2x(plusTertiary, plusTertiary2x),
}

// TODO: make this <a> instead?
export default styled(({ variant, ...props }) => <button type="button" {...props} />)(
  ({ variant }) => ({
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
    height: 72,
    outline: 'none',
    padding: 0,
    width: 72,
  }),
)
