import * as React from 'react'
import * as M from '@material-ui/core'
import { styled } from '@material-ui/styles'

import styledBy from 'utils/styledBy'

import Bar from 'website/components/Bar'

const avatarGradients = {
  primary: 'linear-gradient(to top, #f1b39d, #f78881)',
  secondary: 'linear-gradient(to top, #5c83ea, #6752e6)',
  tertiary: 'linear-gradient(to top, #c2ead6, #3c85da)',
}

const Avatar = styled(({ children, color, ...props }) => (
  <M.Box
    display="flex"
    alignItems="center"
    justifyContent="center"
    height={80}
    width={80}
    minWidth={80}
    {...props}
  >
    <M.Typography variant="h3" color="textPrimary">
      {children}
    </M.Typography>
  </M.Box>
))({
  borderRadius: '50%',
  background: styledBy('color', avatarGradients),
})

const Testimonial = ({ color, initial, name, children, ...props }) => (
  <M.Box pt={7} display="flex" flexDirection={{ xs: 'column', sm: 'row' }} {...props}>
    <Avatar color={color} mr={{ xs: 0, sm: 5 }} mb={{ xs: 3, sm: 0 }}>
      {initial}
    </Avatar>
    <M.Box>
      <M.Typography variant="h4" color="textPrimary">
        {name}
      </M.Typography>
      <M.Box mt={2}>
        <M.Typography variant="body1" color="textSecondary">
          {children}
        </M.Typography>
      </M.Box>
    </M.Box>
  </M.Box>
)

export default () => (
  <M.Container maxWidth="lg" style={{ position: 'relative', zIndex: 1 }}>
    <M.Box pt={10} pb={10}>
      <Bar color="primary" />
      <M.Box mt={5}>
        <M.Typography variant="h1" color="textPrimary">
          Testimonials
        </M.Typography>
      </M.Box>
      <M.Box>
        <Testimonial color="primary" initial="A" name="Allen Institute for Cell Science">
          Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor
          incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
          nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
          Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
          fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
          culpa qui officia deserunt mollit anim id est laborum.
        </Testimonial>
        <Testimonial color="secondary" initial="B" name="Bastille Networks">
          Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor
          incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
          nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
        </Testimonial>
        <Testimonial color="tertiary" initial="K" name="Karr Lab">
          Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor
          incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
          nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
          Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
          fugiat nulla pariatur.
        </Testimonial>
      </M.Box>
    </M.Box>
  </M.Container>
)
