import * as React from 'react'

import Layout from 'website/components/Layout'
import Contribute from 'website/components/Contribute'

import CaseStudies from './CaseStudies'
import Highlights from './Highlights'
import Platform from './Platform'
import Pricing from './Pricing'
import Showcase from './Showcase'
import Testimonials from './Testimonials'
import UseQuilt from './UseQuilt'
import Videos from './Videos'

export default () => (
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
