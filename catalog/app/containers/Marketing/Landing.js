import * as React from 'react'

import Layout from 'components/Layout'

import Hero from './Hero'
import Theme from './Theme'
import Highlights from './Highlights'
import MoreAboutQuilt from './MoreAboutQuilt'
// import Packages from './Packages'
import Pricing from './Pricing'
import Testimonials from './Testimonials'
import UseQuilt from './UseQuilt'

export default () => (
  <Theme>
    <Layout
      pre={
        <>
          <Hero />
          {/* <Packages /> */}
          <UseQuilt />
          <Highlights />
          <Testimonials />
          <Pricing />
          <MoreAboutQuilt />
        </>
      }
    />
  </Theme>
)
