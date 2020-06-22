import * as React from 'react'

import * as Config from 'utils/Config'
import * as LinkedData from 'utils/LinkedData'

import Dots from 'website/components/Backgrounds/Dots'
import Layout from 'website/components/Layout'
import Contribute from 'website/components/Contribute'
import Videos from 'website/components/Videos'

import Buckets from './Buckets'
import CaseStudies from './CaseStudies'
import Highlights from './Highlights'
import LocalMode from './LocalMode'
import Logos from './Logos'
import Platform from './Platform'
import Pricing from './Pricing'
import Showcase from './Showcase'
import StickyFooter from './StickyFooter'
import Testimonials from './Testimonials'
import UseQuilt from './UseQuilt'

export default function Landing() {
  const cfg = Config.useConfig()
  return (
    <Layout>
      <React.Suspense fallback={null}>
        <LinkedData.CatalogData />
      </React.Suspense>
      {cfg.mode !== 'LOCAL' && <Dots />}
      {cfg.mode === 'PRODUCT' && <Buckets />}
      {cfg.mode === 'LOCAL' ? <LocalMode /> : <Showcase />}
      {cfg.mode !== 'LOCAL' && <Videos />}
      {cfg.mode !== 'LOCAL' && <Platform />}
      {cfg.mode !== 'LOCAL' && <Logos />}
      {cfg.mode !== 'LOCAL' && <CaseStudies />}
      {cfg.mode !== 'LOCAL' && <Testimonials />}
      {cfg.mode !== 'LOCAL' && <UseQuilt />}
      {cfg.mode !== 'LOCAL' && <Highlights />}
      {cfg.mode === 'MARKETING' && <Pricing />}
      {cfg.mode !== 'LOCAL' && <Contribute />}
      {cfg.mode !== 'LOCAL' && <StickyFooter />}
    </Layout>
  )
}
