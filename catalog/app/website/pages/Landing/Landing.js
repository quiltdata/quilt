import * as React from 'react'

import * as Config from 'utils/Config'
import * as LinkedData from 'utils/LinkedData'
import MetaTitle from 'utils/MetaTitle'
import parseSearch from 'utils/parseSearch'

import Dots from 'website/components/Backgrounds/Dots'
import Layout from 'website/components/Layout'
import Contribute from 'website/components/Contribute'

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

export default function Landing({ location }) {
  const cfg = Config.useConfig()
  const { q: query = '' } = parseSearch(location.search)
  const showMarketingBlocks = cfg.mode !== 'LOCAL' && cfg.mode !== 'PRODUCT'
  return (
    <Layout>
      <MetaTitle />
      <React.Suspense fallback={null}>
        <LinkedData.CatalogData />
      </React.Suspense>
      {cfg.mode !== 'LOCAL' && (
        <Dots style={{ bottom: cfg.mode === 'PRODUCT' ? 0 : undefined }} />
      )}
      {cfg.mode === 'PRODUCT' && <Buckets query={query} />}
      {cfg.mode === 'LOCAL' && <LocalMode />}
      {showMarketingBlocks && (
        <>
          <Showcase />
          <UseQuilt />
          <Logos />
          <CaseStudies />
          <Testimonials />
          <Platform />
          <Highlights />
        </>
      )}
      {cfg.mode === 'MARKETING' && <Pricing />}
      {showMarketingBlocks && <Contribute />}
      {cfg.mode === 'MARKETING' && <StickyFooter />}
    </Layout>
  )
}
