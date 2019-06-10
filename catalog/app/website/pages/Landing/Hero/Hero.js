import * as React from 'react'
import * as M from '@material-ui/core'
import { styled } from '@material-ui/styles'

import offset from 'utils/bgOffset'
import img2x from 'utils/img2x'
import Backlight1 from 'website/components/Backgrounds/Backlight1'
import Dots from 'website/components/Backgrounds/Dots'
import Overlay1 from 'website/components/Backgrounds/Overlay1'
import Overlay2 from 'website/components/Backgrounds/Overlay2'
import Bar from 'website/components/Bar'

import heroArt from './hero-illustration.png'
import heroArt2x from './hero-illustration@2x.png'

const Art = styled(M.Box)(({ theme: t }) => ({
  backgroundImage: `url(${img2x(heroArt, heroArt2x)})`,
  [t.breakpoints.up('md')]: {
    backgroundPosition: `top left ${offset(770)}`,
    backgroundSize: 'auto 100%',
    height: 739,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 210,
  },
  [t.breakpoints.down('sm')]: {
    backgroundPosition: 'center',
    backgroundSize: 'contain',
    marginBottom: t.spacing(7),
    marginTop: t.spacing(5),
    paddingBottom: '73.9%',
    position: 'relative',
    width: '100%',
  },
}))

const Arrow = styled((props) => <M.Icon {...props}>arrow_forward</M.Icon>)(
  ({ theme: t }) => ({
    color: t.palette.common.white,
    marginLeft: '0.5em',
    verticalAlign: 'top',
  }),
)

export default () => (
  <M.Container maxWidth="lg">
    <Backlight1 />
    <Dots />
    <Overlay2 />
    <Overlay1 />
    <Art />
    <M.Box
      pt={{ xs: 0, md: 28 }}
      pb={{ xs: 20, md: 36 }}
      maxWidth={{ xs: 'unset', md: 320 }}
      position="relative"
      display="flex"
      flexDirection="column"
      alignItems={{ xs: 'center', md: 'unset' }}
    >
      <Bar color="primary" />
      <M.Box mt={5} textAlign={{ xs: 'center', md: 'unset' }}>
        <M.Typography variant="h1" color="textPrimary">Trust your data and models.</M.Typography>
      </M.Box>
      <M.Box mt={4} textAlign={{ xs: 'center', md: 'unset' }}>
        <M.Typography variant="body1" color="textSecondary">
          Quilt is continuous integration and deployment for data science.
        </M.Typography>
      </M.Box>
      <M.Box mt={5}>
        <M.Button variant="contained" color="primary" href="">
          Sign Up
        </M.Button>
        <M.Box display="inline-block" ml={2} />
        <M.Button variant="contained" color="secondary" href="">
          Request Demo
        </M.Button>
      </M.Box>
      <M.Box mt={{ xs: 8, md: 16 }}>
        <M.Typography color="textSecondary">
          <i>install &amp; sync your first project:</i>
        </M.Typography>
      </M.Box>
      <M.Box mt={2}>
        <M.Link href="TBD" color="primary" variant="button" underline="none">
          Get Started
          <Arrow />
        </M.Link>
      </M.Box>
    </M.Box>
  </M.Container>
)
