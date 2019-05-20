import * as React from 'react'
import { Button, Hidden, Icon, Link, Typography } from '@material-ui/core'
import { styled } from '@material-ui/styles'
import { unstable_Box as Box } from '@material-ui/core/Box'

import * as Layout from 'components/Layout'

import Bar from 'website/components/Bar'
import * as Backgrounds from 'website/components/Backgrounds'

import heroArt from './hero-illustration.png'
import heroArt2x from './hero-illustration@2x.png'


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


export default () => (
  <Layout.Container>
    <Backgrounds.Backlight1 />
    <Backgrounds.Dots />
    <Backgrounds.Overlay2 />
    <Backgrounds.Overlay1 />
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
