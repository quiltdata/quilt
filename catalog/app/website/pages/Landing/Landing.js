import * as React from 'react'

import Layout from 'website/components/Layout'
import Contribute from 'website/components/Contribute'

import CaseStudies from './CaseStudies'
import Platform from './Platform'
import Showcase from './Showcase'
import Testimonials from './Testimonials'
import Videos from './Videos'

export default () => (
  <Layout>
    <Showcase />
    <Videos />
    <Platform />
    <CaseStudies />
    <Testimonials />
    <Contribute />
  </Layout>
)
