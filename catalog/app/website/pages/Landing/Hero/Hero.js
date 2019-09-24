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
        <M.Typography variant="h1" color="textPrimary">
          A versioned data portal for AWS
          {
            // A visual data portal for AWS
            // A versioned data portal for AWS
            // Drive your team with data
          }
        </M.Typography>
      </M.Box>
      <M.Box mt={4} textAlign={{ xs: 'center', md: 'unset' }}>
        <M.Typography variant="body1" color="textSecondary">
          <p>Share, understand, discover, and model data at scale.</p>
          <p>
            Get everyone on your team to be more data driven with Quilt&apos;s web
            catalog, Python client, and backend services that enhance your private S3
            buckets.
          </p>
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
    </M.Box>
  </M.Container>
)
