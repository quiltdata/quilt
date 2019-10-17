import * as React from 'react'

import * as Config from 'utils/Config'

import Dots from 'website/components/Backgrounds/Dots'
import Layout from 'website/components/Layout'
import Contribute from 'website/components/Contribute'
import Videos from 'website/components/Videos'

import Buckets from './Buckets'
import CaseStudies from './CaseStudies'
import Highlights from './Highlights'
import Platform from './Platform'
import Pricing from './Pricing'
import Showcase from './Showcase'
import Testimonials from './Testimonials'
import UseQuilt from './UseQuilt'

export default function Landing() {
  const cfg = Config.useConfig()
  return (
    <Layout>
      <Dots />
      {cfg.mode === 'PRODUCT' && <Buckets />}
      <Showcase />
      <Videos />
      <Platform />
      <CaseStudies />
      <Testimonials />
      <UseQuilt />
      <Highlights />
      <Pricing />
      <Contribute />
    </Layout>
  )
}
