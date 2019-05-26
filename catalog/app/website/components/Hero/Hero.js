import * as React from 'react'
import { Button, Hidden, Icon, Link, Typography } from '@material-ui/core'
import { styled } from '@material-ui/styles'
import { unstable_Box as Box } from '@material-ui/core/Box'

import { Container } from 'components/Layout'
import offset from 'utils/bgOffset'
import img2x from 'utils/img2x'
import Backlight1 from 'website/components/Backgrounds/Backlight1'
import Dots from 'website/components/Backgrounds/Dots'
import Overlay1 from 'website/components/Backgrounds/Overlay1'
import Overlay2 from 'website/components/Backgrounds/Overlay2'
import Bar from 'website/components/Bar'

import heroArt from './hero-illustration.png'
import heroArt2x from './hero-illustration@2x.png'

const Art = styled(Box)({
  backgroundImage: `url(${img2x(heroArt, heroArt2x)})`,
  backgroundPosition: `top left ${offset(770)}`,
  backgroundSize: 'auto 100%',
  height: 739,
  position: 'absolute',
  right: 0,
  left: 0,
  top: 210,
})

const Arrow = styled((props) => <Icon {...props}>arrow_forward</Icon>)(
  ({ theme: t }) => ({
    color: t.palette.common.white,
    marginLeft: '0.5em',
    verticalAlign: 'top',
  }),
)

export default () => (
  <Container>
    <Backlight1 />
    <Dots />
    <Overlay2 />
    <Overlay1 />
    <Hidden xsDown>
      <Art />
    </Hidden>
    <Box
      pt={28}
      pb={10}
      maxWidth={['unset', 320]}
      position="relative"
      display="flex"
      flexDirection="column"
      alignItems={['center', 'unset']}
    >
      <Bar color="primary" />
      <Box mt={5} textAlign={['center', 'unset']}>
        <Typography variant="h1">Trust your data and models.</Typography>
      </Box>
      <Box mt={4}>
        <Typography variant="body1" color="textSecondary">
          Quilt is continuous integration and deployment for data science.
        </Typography>
      </Box>
      <Box mt={5}>
        <Button variant="contained" color="primary" href="">
          Sign Up
        </Button>
        <Box display="inline-block" ml={2} />
        <Button variant="contained" color="secondary" href="">
          Request Demo
        </Button>
      </Box>
      <Box mt={16}>
        <Typography color="textSecondary">
          <i>install &amp; sync your first project:</i>
        </Typography>
      </Box>
      <Box mt={2}>
        <Link href="TBD" color="primary" variant="button" underline="none">
          Get Started
          <Arrow />
        </Link>
      </Box>
    </Box>
  </Container>
)
