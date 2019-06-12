import * as React from 'react'

import Layout from 'website/components/Layout'

import Hero from './Hero'
import UseQuilt from './UseQuilt'
import Highlights from './Highlights'
//import MoreAboutQuilt from './MoreAboutQuilt'
import Pricing from './Pricing'
import Testimonials from './Testimonials'

export default () => (
  <Layout>
    <Hero />
    <UseQuilt />
    <Highlights />
    <Testimonials />
    <Pricing />
    {/*
    <MoreAboutQuilt />
    */}
  </Layout>
)
