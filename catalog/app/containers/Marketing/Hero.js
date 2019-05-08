import * as React from 'react'
import { Button, Hidden, Icon, Link, Typography } from '@material-ui/core'
import { styled } from '@material-ui/styles'
import { unstable_Box as Box } from '@material-ui/core/Box'

import * as Layout from 'components/Layout'

import Bar from './Bar'

import backlight1 from './backlight1.png'
import overlay1 from './overlay1.png'
import overlay2 from './overlay2.png'
import dots from './dots.png'
import heroArt from './hero-illustration.png'
import heroArt2x from './hero-illustration@2x.png'

const ASSET_WIDTH = 1920

const img2x = (x1, x2) => (window.devicePixelRatio >= 1.5 ? x2 : x1)

const offset = (o = 0) => `calc(${o}px - (${ASSET_WIDTH}px - 100vw) / 2)`

const Art = styled('div')({
  backgroundImage: `url(${img2x(heroArt, heroArt2x)})`,
  backgroundPosition: `top left ${offset(770)}`,
  backgroundSize: 'auto 100%',
  height: 739,
  position: 'absolute',
  right: 0,
  left: 0,
  top: 210,
})

const Backlight1 = styled('div')({
  backgroundImage: `url(${backlight1})`,
  backgroundPosition: 'center',
  backgroundSize: 'cover',
  height: 1449,
  left: 0,
  position: 'absolute',
  right: 0,
})

const Pattern = styled('div')({
  backgroundImage: `url(${dots})`,
  backgroundRepeat: 'repeat',
  backgroundSize: 101,
  height: 1790,
  left: 0,
  mixBlendMode: 'overlay',
  position: 'absolute',
  right: 0,
})

const Overlay1 = styled('div')({
  backgroundImage: `url(${overlay1})`,
  backgroundPosition: 'center',
  backgroundSize: 'cover',
  height: 741,
  left: 0,
  mixBlendMode: 'overlay',
  position: 'absolute',
  right: 0,
})

const Overlay2 = styled('div')({
  backgroundImage: `url(${overlay2})`,
  backgroundPosition: `top left ${offset()}`,
  backgroundSize: 'cover',
  height: 1105,
  left: 0,
  mixBlendMode: 'overlay',
  position: 'absolute',
  right: 0,
})

const Arrow = styled((props) => <Icon {...props}>arrow_forward</Icon>)(
  ({ theme: t }) => ({
    color: t.palette.common.white,
    marginLeft: '0.5em',
    verticalAlign: 'top',
  }),
)

export default () => (
  <Layout.Container>
    <Backlight1 />
    <Pattern />
    <Overlay2 />
    <Overlay1 />
    <Hidden xsDown>
      <Art />
    </Hidden>
    <Box pt={28} pb={10} maxWidth={320} position="relative">
      <Bar color="primary" />
      <Box mt={5}>
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
  </Layout.Container>
)
