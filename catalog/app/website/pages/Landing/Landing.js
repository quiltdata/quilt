import * as React from 'react'

import Layout from 'website/components/Layout'

import CaseStudies from './CaseStudies'
import Platform from './Platform'
import Showcase from './Showcase'
import Videos from './Videos'

export default () => (
  <Layout>
    <Showcase />
    <Videos />
    <Platform />
    <CaseStudies />
  </Layout>
)
