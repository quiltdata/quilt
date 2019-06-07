import * as React from 'react'
import { Box, Typography } from '@material-ui/core'
import { styled } from '@material-ui/styles'

import * as Layout from 'components/Layout'
import styledBy from 'utils/styledBy'

import Bar from './Bar'

const avatarGradients = {
  primary: 'linear-gradient(to top, #f1b39d, #f78881)',
  secondary: 'linear-gradient(to top, #5c83ea, #6752e6)',
  tertiary: 'linear-gradient(to top, #c2ead6, #3c85da)',
}

const Avatar = styled(({ children, color, ...props }) => (
  <Box
    display="flex"
    alignItems="center"
    justifyContent="center"
    height={80}
    width={80}
    minWidth={80}
    {...props}
  >
    <Typography variant="h3">{children}</Typography>
  </Box>
))({
  borderRadius: '50%',
  background: styledBy('color', avatarGradients),
})

const Testimonial = ({ color, initial, name, children, ...props }) => (
  <Box pt={7} display="flex" {...props}>
    <Avatar color={color} mr={5}>
      {initial}
    </Avatar>
    <Box>
      <Typography variant="h4">{name}</Typography>
      <Box mt={2}>
        <Typography variant="body1" color="textSecondary">
          {children}
        </Typography>
      </Box>
    </Box>
  </Box>
)

export default () => (
  <Layout.Container position="relative" zIndex={1}>
    <Box pt={18} pb={10}>
      <Bar color="primary" />
      <Box mt={5} mb={2}>
        <Typography variant="h1">Testimonials</Typography>
      </Box>
      <Box>
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
      </Box>
    </Box>
  </Layout.Container>
)
