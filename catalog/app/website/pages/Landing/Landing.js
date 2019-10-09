import * as React from 'react'

import Layout from 'website/components/Layout'
import Contribute from 'website/components/Contribute'
import Videos from 'website/components/Videos'

import CaseStudies from './CaseStudies'
import Highlights from './Highlights'
import Platform from './Platform'
import Pricing from './Pricing'
import Showcase from './Showcase'
import Testimonials from './Testimonials'
import UseQuilt from './UseQuilt'

export default function Landing() {
  return (
    <Layout>
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
